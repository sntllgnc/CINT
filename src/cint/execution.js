import { randomUUID } from "node:crypto";

import {
  assertCint,
  assertExactKeys,
  isoInstant,
  sealRecord,
  verifySealedRecord
} from "./canonical.js";
import { createOutcome } from "./outcome.js";
import { revalidateReceipt } from "./revalidation.js";
import { performRollback } from "./rollback.js";

function eventId(type) {
  return `event.${type.toLowerCase()}.${randomUUID()}`;
}

function failureResult({ receipt, status, code, at, consumption = null, revalidation = null, actionStarted = false }) {
  return sealRecord({
    protocol: "cint/execution-result/1",
    status,
    receipt_id: receipt?.id ?? null,
    receipt_digest: receipt?.digest ?? null,
    consumption_digest: consumption?.digest ?? null,
    revalidation_digest: revalidation?.digest ?? null,
    action_started: actionStarted,
    outcome: null,
    evidence_seal: null,
    error_code: code,
    completed_at: at
  });
}

function statusForError(error, revalidation) {
  if (error?.code === "CINT_RECEIPT_REPLAY_REJECTED") return "REPLAY_REJECTED";
  if (revalidation?.status === "REJECTED") return "REJECTED";
  if (revalidation?.status === "REVOKED" || error?.code === "CINT_RECEIPT_REVOKED") return "REVOKED";
  return "FAIL_CLOSED";
}

async function record(ledger, type, at, payload) {
  return ledger.record({ event_id: eventId(type), type, at, payload });
}

async function sealedResult({
  input,
  consumption,
  revalidation,
  outcome,
  status,
  errorCode = null,
  actionStarted = true
}) {
  const outcomeEvent = await record(input.ledger, `OUTCOME_${outcome.status}`, input.at, {
    receipt_digest: input.receipt.digest,
    outcome_digest: outcome.digest
  });
  const seal = input.seal_authority.issue({
    receipt: input.receipt,
    consumption,
    revalidation,
    outcome,
    ledger_head: outcomeEvent,
    issued_at: input.at
  });
  input.seal_authority.verify(seal);
  return sealRecord({
    protocol: "cint/execution-result/1",
    status,
    receipt_id: input.receipt.id,
    receipt_digest: input.receipt.digest,
    consumption_digest: consumption.digest,
    revalidation_digest: revalidation.digest,
    action_started: actionStarted,
    outcome,
    evidence_seal: seal,
    error_code: errorCode,
    completed_at: input.at
  });
}

export async function executeWithReceipt(input) {
  assertExactKeys(
    input,
    [
      "receipt",
      "receipt_authority",
      "store",
      "snapshot_provider",
      "adapter",
      "seal_authority",
      "ledger",
      "at"
    ],
    ["signal"],
    "execution request"
  );
  const at = isoInstant(input.at, "execution time");
  const available =
    typeof input.snapshot_provider === "function" &&
    input.receipt_authority?.verify instanceof Function &&
    input.store?.consume instanceof Function &&
    input.adapter?.prepare instanceof Function &&
    input.adapter?.execute instanceof Function &&
    input.seal_authority?.issue instanceof Function &&
    input.ledger?.record instanceof Function;
  if (!available) {
    return failureResult({
      receipt: input.receipt,
      status: "FAIL_CLOSED",
      code: "CINT_UNAVAILABLE",
      at,
      actionStarted: false
    });
  }
  try {
    verifySealedRecord(input.receipt, "receipt");
  } catch (error) {
    return failureResult({
      receipt: input.receipt,
      status: "REJECTED",
      code: error.code ?? "CINT_RECEIPT_INVALID",
      at,
      actionStarted: false
    });
  }

  let lockedSnapshot = null;
  let consumption = null;
  let revalidation = null;
  try {
    input.receipt_authority.verify(input.receipt, { now: at });
    await record(input.ledger, "RECEIPT_PRESENTED", at, { receipt_digest: input.receipt.digest });
    consumption = await input.store.consume(input.receipt, {
      consumed_at: at,
      revalidate: async () => {
        lockedSnapshot = await input.snapshot_provider();
        revalidation = revalidateReceipt({
          receipt: input.receipt,
          receipt_authority: input.receipt_authority,
          ...lockedSnapshot,
          now: at
        });
        return revalidation;
      }
    });
    await record(input.ledger, "RECEIPT_CONSUMED", at, {
      receipt_digest: input.receipt.digest,
      consumption_digest: consumption.digest,
      revalidation_digest: revalidation.digest
    });
  } catch (error) {
    return failureResult({
      receipt: input.receipt,
      status: statusForError(error, revalidation),
      code: error.code ?? "CINT_FAIL_CLOSED",
      at,
      consumption,
      revalidation,
      actionStarted: false
    });
  }

  let currentSnapshot;
  try {
    currentSnapshot = await input.snapshot_provider();
    revalidation = revalidateReceipt({
      receipt: input.receipt,
      receipt_authority: input.receipt_authority,
      ...currentSnapshot,
      now: at
    });
    if (revalidation.status !== "VALID") {
      return failureResult({
        receipt: input.receipt,
        status: statusForError(null, revalidation),
        code: revalidation.reason_codes[0] ?? "CINT_REVALIDATION_FAILED",
        at,
        consumption,
        revalidation,
        actionStarted: false
      });
    }
    assertCint(input.adapter.id === currentSnapshot.adapter_capability.id, "CINT_ADAPTER_MISMATCH", "Runtime adapter does not match the current capability");
    await record(input.ledger, "EXECUTION_REVALIDATED", at, {
      receipt_digest: input.receipt.digest,
      revalidation_digest: revalidation.digest
    });
  } catch (error) {
    return failureResult({
      receipt: input.receipt,
      status: "FAIL_CLOSED",
      code: error.code ?? "CINT_FAIL_CLOSED",
      at,
      consumption,
      revalidation,
      actionStarted: false
    });
  }

  let prepared = null;
  let execution = null;
  let actionStarted = false;
  try {
    prepared = await input.adapter.prepare(currentSnapshot.intent, { at, signal: input.signal });
    await record(input.ledger, "EXECUTION_STARTED", at, {
      receipt_digest: input.receipt.digest,
      action_digest: currentSnapshot.intent.action_digest,
      target_digest: currentSnapshot.intent.target_digest
    });
    actionStarted = true;
    execution = await input.adapter.execute(prepared, { at, signal: input.signal });
    verifySealedRecord(execution, "adapter execution");
    const verification = await input.adapter.verify(prepared, execution, { at, signal: input.signal });
    verifySealedRecord(verification, "outcome verification");
    if (verification.status === "VERIFIED") {
      const outcome = createOutcome({
        receipt: input.receipt,
        execution,
        verification,
        rollback: null,
        completed_at: at
      });
      return await sealedResult({ input, consumption, revalidation, outcome, status: "SEALED" });
    }
    const rollback = await performRollback(input.adapter, prepared, { at, signal: input.signal });
    assertCint(rollback.status === "RESTORED", "CINT_ROLLBACK_FAILED", "Divergent outcome could not be restored");
    const outcome = createOutcome({
      receipt: input.receipt,
      execution,
      verification,
      rollback,
      completed_at: at
    });
    return await sealedResult({ input, consumption, revalidation, outcome, status: "ROLLED_BACK" });
  } catch (error) {
    if (prepared && actionStarted) {
      const interruptedExecution = execution ?? sealRecord({
        protocol: "cint/execution-interruption/1",
        status: "INTERRUPTED",
        error_code: error.code ?? "CINT_EXECUTION_FAILED",
        interrupted_at: at
      });
      const verification = await input.adapter.verify(prepared, interruptedExecution, { at, signal: input.signal }).catch(() =>
        sealRecord({
          protocol: "cint/outcome-verification/1",
          status: "DIVERGED",
          target: "unknown",
          expected_sha256: prepared.after_sha256,
          actual_sha256: "0".repeat(64),
          checked_at: at
        })
      );
      const rollback = await performRollback(input.adapter, prepared, { at, signal: input.signal });
      if (rollback.status === "RESTORED") {
        const outcome = createOutcome({
          receipt: input.receipt,
          execution: interruptedExecution,
          verification,
          rollback,
          completed_at: at
        });
        return await sealedResult({
          input,
          consumption,
          revalidation,
          outcome,
          status: "ROLLED_BACK",
          errorCode: error.code ?? "CINT_EXECUTION_FAILED"
        });
      }
    }
    return failureResult({
      receipt: input.receipt,
      status: "FAIL_CLOSED",
      code: error.code ?? "CINT_FAIL_CLOSED",
      at,
      consumption,
      revalidation,
      actionStarted
    });
  }
}
