import { randomUUID } from "node:crypto";

import {
  assertCint,
  assertExactKeys,
  identifier,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifyProtocolRecord,
  verifySealedRecord
} from "./canonical.js";
import type { ExecutionLedgerEntry } from "./evidence.js";
import {
  createOutcome,
  verifyOutcomeVerification
} from "./outcome.js";
import { revalidateReceipt, type ReceiptVerifier } from "./revalidation.js";
import { performRollback } from "./rollback.js";
import type { OutcomeSealInput } from "./seal.js";
import type {
  AdapterId,
  CanonicalInstant,
  ExecutionDigest,
  Identifier
} from "./types/brands.js";
import type { AdapterOperationOptions } from "./types/adapters.js";
import type {
  AdapterCapability,
  AuthorityRecord,
  ConsumedReceiptRecord,
  EvidenceSeal,
  ExecutionResult,
  FailedExecutionResult,
  IntentRecord,
  IssuedDecisionReceipt,
  MachineStateSnapshot,
  Outcome,
  OutcomeVerification,
  PolicySnapshot,
  PrincipalRecord,
  Revalidation,
  ValidRevalidation
} from "./types/records.js";
import type { JsonRecord } from "./canonical.js";

export interface TrustedExecutionClock {
  now(): unknown;
}

export interface ExecutionSnapshot {
  readonly intent: IntentRecord;
  readonly principal: PrincipalRecord;
  readonly authority: AuthorityRecord;
  readonly policy: PolicySnapshot;
  readonly adapter_capability: AdapterCapability;
  readonly machine_state: MachineStateSnapshot;
}

export interface ExecutionAdapter {
  readonly id: AdapterId | string;
  readonly capability: AdapterCapability;
  prepare(intent: IntentRecord, options: AdapterOperationOptions): Promise<unknown>;
  execute(prepared: unknown, options: AdapterOperationOptions): Promise<unknown>;
  verify(prepared: unknown, execution: unknown, options: AdapterOperationOptions): Promise<unknown>;
  rollback?(prepared: unknown, options: AdapterOperationOptions): Promise<unknown>;
}

export interface ReceiptConsumptionStore {
  consume(
    receipt: IssuedDecisionReceipt,
    input: {
      readonly consumed_at: unknown;
      readonly revalidate: (receipt: IssuedDecisionReceipt) => Promise<unknown>;
    }
  ): Promise<ConsumedReceiptRecord>;
}

export interface ExecutionSealAuthority {
  issue(input: OutcomeSealInput): EvidenceSeal;
  verify(seal: unknown): EvidenceSeal;
}

export interface ExecutionLedgerBoundary {
  record(input: unknown): Promise<ExecutionLedgerEntry>;
}

export interface ExecuteWithReceiptInput {
  readonly receipt: IssuedDecisionReceipt;
  readonly receipt_authority: ReceiptVerifier;
  readonly store: ReceiptConsumptionStore;
  readonly snapshot_provider: () => Promise<unknown>;
  readonly clock: TrustedExecutionClock;
  readonly adapter: ExecutionAdapter;
  readonly seal_authority: ExecutionSealAuthority;
  readonly ledger: ExecutionLedgerBoundary;
  readonly at: unknown;
  readonly signal?: AbortSignal | undefined;
}

type AvailableExecutionRuntime = JsonRecord & {
  readonly receipt: unknown;
  readonly receipt_authority: ReceiptVerifier;
  readonly store: ReceiptConsumptionStore;
  readonly snapshot_provider: () => Promise<unknown>;
  readonly clock: TrustedExecutionClock;
  readonly adapter: ExecutionAdapter;
  readonly seal_authority: ExecutionSealAuthority;
  readonly ledger: ExecutionLedgerBoundary;
  readonly at: unknown;
  readonly signal?: AbortSignal | undefined;
};

interface AdapterExecutionEvidence {
  readonly raw: unknown;
  readonly digest: ExecutionDigest;
}

interface FailureInput {
  readonly receipt: unknown;
  readonly status: FailedExecutionResult["status"];
  readonly code: string;
  readonly at: CanonicalInstant;
  readonly consumption?: ConsumedReceiptRecord | null;
  readonly revalidation?: Revalidation | null;
  readonly actionStarted?: boolean;
}

interface SealedResultInput {
  readonly runtime: AvailableExecutionRuntime;
  readonly receipt: IssuedDecisionReceipt;
  readonly consumption: ConsumedReceiptRecord;
  readonly revalidation: ValidRevalidation;
  readonly outcome: Outcome;
  readonly status: "SEALED" | "ROLLED_BACK";
  readonly at: CanonicalInstant;
  readonly errorCode?: string | null;
  readonly actionStarted?: boolean;
}

function property(value: unknown, name: string): unknown {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? Reflect.get(value, name)
    : undefined;
}

function errorCode(error: unknown, fallback: string): string {
  const code = property(error, "code");
  return typeof code === "string" ? code : fallback;
}

function eventId(type: string): Identifier {
  return identifier<Identifier>(`event.${type.toLowerCase()}.${randomUUID()}`, "ledger event id");
}

function trustedExecutionTime(clock: TrustedExecutionClock): CanonicalInstant {
  return isoInstant(clock.now(), "trusted execution time");
}

function operationOptions(at: CanonicalInstant, signal: AbortSignal | undefined): AdapterOperationOptions {
  return signal === undefined ? { at } : { at, signal };
}

function availableExecutionRuntime(input: JsonRecord): input is AvailableExecutionRuntime {
  const adapter = input["adapter"];
  const capabilityValue = property(adapter, "capability");
  let capability: AdapterCapability;
  try {
    capability = verifyProtocolRecord(capabilityValue, "cint/adapter-capability/1", "adapter capability");
  } catch {
    return false;
  }
  const clock = input["clock"];
  const receiptAuthority = input["receipt_authority"];
  const store = input["store"];
  const sealAuthority = input["seal_authority"];
  const ledger = input["ledger"];
  return (
    typeof input["snapshot_provider"] === "function" &&
    typeof property(clock, "now") === "function" &&
    typeof property(receiptAuthority, "verify") === "function" &&
    typeof property(store, "consume") === "function" &&
    typeof property(adapter, "id") === "string" &&
    property(adapter, "id") === capability.id &&
    capability.prepare_side_effect_free === true &&
    capability.outcome_verification === true &&
    typeof property(adapter, "prepare") === "function" &&
    typeof property(adapter, "execute") === "function" &&
    typeof property(adapter, "verify") === "function" &&
    (capability.rollback !== true || typeof property(adapter, "rollback") === "function") &&
    typeof property(sealAuthority, "issue") === "function" &&
    typeof property(sealAuthority, "verify") === "function" &&
    typeof property(ledger, "record") === "function"
  );
}

function failureResult(input: FailureInput): FailedExecutionResult {
  const sealed = sealRecord({
    protocol: "cint/execution-result/1" as const,
    status: input.status,
    receipt_id: property(input.receipt, "id") ?? null,
    receipt_digest: property(input.receipt, "digest") ?? null,
    consumption_digest: input.consumption?.digest ?? null,
    revalidation_digest: input.revalidation?.digest ?? null,
    action_started: input.actionStarted ?? false,
    outcome: null,
    evidence_seal: null,
    error_code: input.code,
    completed_at: input.at
  });
  const result = verifyProtocolRecord(sealed, "cint/execution-result/1", "execution failure");
  assertCint(
    result.status === "REPLAY_REJECTED" ||
      result.status === "REJECTED" ||
      result.status === "REVOKED" ||
      result.status === "FAIL_CLOSED",
    "CINT_FAIL_CLOSED",
    "Execution failure has a non-failure status"
  );
  return result;
}

function statusForError(error: unknown, revalidation: Revalidation | null): FailedExecutionResult["status"] {
  if (property(error, "code") === "CINT_RECEIPT_REPLAY_REJECTED") return "REPLAY_REJECTED";
  if (revalidation?.status === "REJECTED") return "REJECTED";
  if (revalidation?.status === "REVOKED" || property(error, "code") === "CINT_RECEIPT_REVOKED") return "REVOKED";
  return "FAIL_CLOSED";
}

function requiredRevalidation(value: Revalidation | null): Revalidation {
  assertCint(value !== null, "CINT_REVALIDATION_INVALID", "Receipt consumption returned without revalidation");
  return value;
}

async function record(
  ledger: ExecutionLedgerBoundary,
  type: string,
  at: CanonicalInstant,
  payload: unknown
): Promise<ExecutionLedgerEntry> {
  return ledger.record({ event_id: eventId(type), type, at, payload });
}

function snapshotRevalidation(
  receipt: IssuedDecisionReceipt,
  receiptAuthority: ReceiptVerifier,
  snapshot: unknown,
  now: CanonicalInstant
): Revalidation {
  return revalidateReceipt({
    receipt,
    receipt_authority: receiptAuthority,
    intent: property(snapshot, "intent"),
    principal: property(snapshot, "principal"),
    authority: property(snapshot, "authority"),
    policy: property(snapshot, "policy"),
    adapter_capability: property(snapshot, "adapter_capability"),
    machine_state: property(snapshot, "machine_state"),
    now
  });
}

function executionSnapshot(value: unknown): ExecutionSnapshot {
  return {
    intent: verifyProtocolRecord(property(value, "intent"), "cint/intent/1", "intent"),
    principal: verifyProtocolRecord(property(value, "principal"), "cint/principal/1", "principal"),
    authority: verifyProtocolRecord(property(value, "authority"), "cint/authority/1", "authority"),
    policy: verifyProtocolRecord(property(value, "policy"), "cint/policy/1", "policy"),
    adapter_capability: verifyProtocolRecord(
      property(value, "adapter_capability"),
      "cint/adapter-capability/1",
      "adapter capability"
    ),
    machine_state: verifyProtocolRecord(property(value, "machine_state"), "cint/machine-state/1", "machine state")
  };
}

function adapterExecution(value: unknown): AdapterExecutionEvidence {
  const record = verifySealedRecord(value, "adapter execution");
  const protocol = record["protocol"];
  assertCint(
    protocol === "cint/synthetic-execution/1" ||
      protocol === "cint/codex-delegation-execution/1" ||
      protocol === "cint/execution-interruption/1",
    "CINT_PROTOCOL_INVALID",
    "Adapter execution uses an unsupported protocol"
  );
  return {
    raw: value,
    digest: sha256Digest<ExecutionDigest>(record["digest"], "adapter execution digest")
  };
}

async function sealedResult(input: SealedResultInput): Promise<ExecutionResult> {
  assertCint(
    (input.status === "SEALED" && input.outcome.status === "VERIFIED") ||
      (input.status === "ROLLED_BACK" && input.outcome.status === "ROLLED_BACK"),
    "CINT_FAIL_CLOSED",
    "Execution result status does not match its outcome"
  );
  const outcomeEvent = await record(input.runtime.ledger, `OUTCOME_${input.outcome.status}`, input.at, {
    receipt_digest: input.receipt.digest,
    outcome_digest: input.outcome.digest
  });
  const seal = input.runtime.seal_authority.issue({
    receipt: input.receipt,
    consumption: input.consumption,
    revalidation: input.revalidation,
    outcome: input.outcome,
    ledger_head: outcomeEvent,
    issued_at: input.at
  });
  input.runtime.seal_authority.verify(seal);
  return verifyProtocolRecord(sealRecord({
    protocol: "cint/execution-result/1" as const,
    status: input.status,
    receipt_id: input.receipt.id,
    receipt_digest: input.receipt.digest,
    consumption_digest: input.consumption.digest,
    revalidation_digest: input.revalidation.digest,
    action_started: input.actionStarted ?? true,
    outcome: input.outcome,
    evidence_seal: seal,
    error_code: input.errorCode ?? null,
    completed_at: input.at
  }), "cint/execution-result/1", "execution result");
}

export function executeWithReceipt(input: ExecuteWithReceiptInput): Promise<ExecutionResult>;
export async function executeWithReceipt(value: unknown): Promise<ExecutionResult> {
  const input = assertExactKeys(
    value,
    [
      "receipt",
      "receipt_authority",
      "store",
      "snapshot_provider",
      "clock",
      "adapter",
      "seal_authority",
      "ledger",
      "at"
    ],
    ["signal"],
    "execution request"
  );
  const at = isoInstant(input["at"], "execution time");
  if (!availableExecutionRuntime(input)) {
    return failureResult({
      receipt: input["receipt"],
      status: "FAIL_CLOSED",
      code: "CINT_UNAVAILABLE",
      at,
      actionStarted: false
    });
  }
  const runtime = input;
  let receipt: IssuedDecisionReceipt;
  try {
    receipt = verifyProtocolRecord(runtime.receipt, "cint/decision-receipt/1", "receipt");
  } catch (error) {
    return failureResult({
      receipt: runtime.receipt,
      status: "REJECTED",
      code: errorCode(error, "CINT_RECEIPT_INVALID"),
      at,
      actionStarted: false
    });
  }

  let lockedSnapshot: unknown = null;
  let consumption: ConsumedReceiptRecord | null = null;
  let revalidation: Revalidation | null = null;
  try {
    runtime.receipt_authority.verify(receipt, { now: at });
    await record(runtime.ledger, "RECEIPT_PRESENTED", at, { receipt_digest: receipt.digest });
    consumption = await runtime.store.consume(receipt, {
      consumed_at: at,
      revalidate: async () => {
        lockedSnapshot = await runtime.snapshot_provider();
        revalidation = snapshotRevalidation(receipt, runtime.receipt_authority, lockedSnapshot, at);
        return revalidation;
      }
    });
    const consumedRevalidation = requiredRevalidation(revalidation);
    revalidation = consumedRevalidation;
    await record(runtime.ledger, "RECEIPT_CONSUMED", at, {
      receipt_digest: receipt.digest,
      consumption_digest: consumption.digest,
      revalidation_digest: consumedRevalidation.digest
    });
  } catch (error) {
    return failureResult({
      receipt,
      status: statusForError(error, revalidation),
      code: errorCode(error, "CINT_FAIL_CLOSED"),
      at,
      consumption,
      revalidation,
      actionStarted: false
    });
  }
  assertCint(consumption !== null, "CINT_FAIL_CLOSED", "Receipt consumption evidence is unavailable");

  let currentSnapshot: ExecutionSnapshot;
  let admittedRevalidation: ValidRevalidation;
  try {
    const rawSnapshot = await runtime.snapshot_provider();
    const checked = snapshotRevalidation(receipt, runtime.receipt_authority, rawSnapshot, at);
    revalidation = checked;
    if (checked.status !== "VALID") {
      return failureResult({
        receipt,
        status: statusForError(null, checked),
        code: checked.reason_codes[0] ?? "CINT_REVALIDATION_FAILED",
        at,
        consumption,
        revalidation: checked,
        actionStarted: false
      });
    }
    admittedRevalidation = checked;
    currentSnapshot = executionSnapshot(rawSnapshot);
    assertCint(
      runtime.adapter.id === currentSnapshot.adapter_capability.id &&
        runtime.adapter.capability.digest === currentSnapshot.adapter_capability.digest,
      "CINT_ADAPTER_MISMATCH",
      "Runtime adapter does not match the current capability"
    );
    await record(runtime.ledger, "EXECUTION_REVALIDATED", at, {
      receipt_digest: receipt.digest,
      revalidation_digest: admittedRevalidation.digest
    });
  } catch (error) {
    return failureResult({
      receipt,
      status: "FAIL_CLOSED",
      code: errorCode(error, "CINT_FAIL_CLOSED"),
      at,
      consumption,
      revalidation,
      actionStarted: false
    });
  }

  let prepared: unknown = null;
  let execution: AdapterExecutionEvidence | null = null;
  let actionStarted = false;
  let executionAt = at;
  try {
    prepared = await runtime.adapter.prepare(currentSnapshot.intent, operationOptions(at, runtime.signal));
    await record(runtime.ledger, "EXECUTION_PREPARED", at, {
      receipt_digest: receipt.digest,
      action_digest: currentSnapshot.intent.action_digest,
      target_digest: currentSnapshot.intent.target_digest
    });

    const finalSnapshotValue = await runtime.snapshot_provider();
    executionAt = trustedExecutionTime(runtime.clock);
    const finalRevalidation = snapshotRevalidation(receipt, runtime.receipt_authority, finalSnapshotValue, executionAt);
    revalidation = finalRevalidation;
    if (finalRevalidation.status !== "VALID") {
      return failureResult({
        receipt,
        status: statusForError(null, finalRevalidation),
        code: finalRevalidation.reason_codes[0] ?? "CINT_REVALIDATION_FAILED",
        at: executionAt,
        consumption,
        revalidation: finalRevalidation,
        actionStarted: false
      });
    }
    const finalSnapshot = executionSnapshot(finalSnapshotValue);
    assertCint(
      runtime.adapter.id === finalSnapshot.adapter_capability.id &&
        runtime.adapter.capability.digest === finalSnapshot.adapter_capability.digest,
      "CINT_ADAPTER_MISMATCH",
      "Runtime adapter does not match the execution-bound capability"
    );
    actionStarted = true;
    const rawExecution = await runtime.adapter.execute(prepared, operationOptions(executionAt, runtime.signal));
    execution = adapterExecution(rawExecution);
    await record(runtime.ledger, "EXECUTION_COMPLETED", executionAt, {
      receipt_digest: receipt.digest,
      execution_digest: execution.digest,
      revalidation_digest: finalRevalidation.digest
    });
    const rawVerification = await runtime.adapter.verify(
      prepared,
      execution.raw,
      operationOptions(executionAt, runtime.signal)
    );
    const verification = verifyOutcomeVerification(rawVerification);
    if (verification.status === "VERIFIED") {
      const outcome = createOutcome({
        receipt,
        execution: execution.raw,
        verification,
        rollback: null,
        completed_at: executionAt
      });
      return await sealedResult({
        runtime,
        receipt,
        consumption,
        revalidation: finalRevalidation,
        outcome,
        status: "SEALED",
        at: executionAt
      });
    }
    const rollback = await performRollback(runtime.adapter, prepared, operationOptions(executionAt, runtime.signal));
    assertCint(rollback.status === "RESTORED", "CINT_ROLLBACK_FAILED", "Divergent outcome could not be restored");
    const outcome = createOutcome({
      receipt,
      execution: execution.raw,
      verification,
      rollback,
      completed_at: executionAt
    });
    return await sealedResult({
      runtime,
      receipt,
      consumption,
      revalidation: finalRevalidation,
      outcome,
      status: "ROLLED_BACK",
      at: executionAt
    });
  } catch (error) {
    if (prepared && actionStarted) {
      const interruptedExecution = execution ?? adapterExecution(sealRecord({
        protocol: "cint/execution-interruption/1" as const,
        status: "INTERRUPTED" as const,
        error_code: errorCode(error, "CINT_EXECUTION_FAILED"),
        interrupted_at: executionAt
      }));
      let verification: OutcomeVerification;
      try {
        verification = verifyOutcomeVerification(await runtime.adapter.verify(
          prepared,
          interruptedExecution.raw,
          operationOptions(executionAt, runtime.signal)
        ));
      } catch {
        verification = verifyOutcomeVerification(sealRecord({
          protocol: "cint/outcome-verification/1" as const,
          status: "DIVERGED" as const,
          target: "unknown",
          expected_sha256: property(prepared, "after_sha256") ?? "0".repeat(64),
          actual_sha256: "0".repeat(64),
          checked_at: executionAt
        }));
      }
      const rollback = await performRollback(runtime.adapter, prepared, operationOptions(executionAt, runtime.signal));
      if (rollback.status === "RESTORED") {
        const outcome = createOutcome({
          receipt,
          execution: interruptedExecution.raw,
          verification,
          rollback,
          completed_at: executionAt
        });
        try {
          assertCint(revalidation?.status === "VALID", "CINT_REVALIDATION_INVALID", "Valid final revalidation is unavailable");
          return await sealedResult({
            runtime,
            receipt,
            consumption,
            revalidation,
            outcome,
            status: "ROLLED_BACK",
            at: executionAt,
            errorCode: errorCode(error, "CINT_EXECUTION_FAILED")
          });
        } catch (sealError) {
          return failureResult({
            receipt,
            status: "FAIL_CLOSED",
            code: errorCode(sealError, "CINT_SEAL_FAILED"),
            at: executionAt,
            consumption,
            revalidation,
            actionStarted
          });
        }
      }
    }
    return failureResult({
      receipt,
      status: "FAIL_CLOSED",
      code: errorCode(error, "CINT_FAIL_CLOSED"),
      at: executionAt,
      consumption,
      revalidation,
      actionStarted
    });
  }
}
