import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DecisionReceiptAuthority,
  FileReceiptStore,
  canonicalDigest,
  createAdapterCapability,
  createAuthorityGrant,
  createIntent,
  createMachineStateSnapshot,
  createPolicySnapshot,
  decide,
  resolvePrincipal,
  sha256
} from "../src/cint/index.js";
import type { AdmitDecision } from "../src/cint/types/records.js";
import {
  hasErrorCode,
  issueUntrusted,
  requireAdmit
} from "./cint-test-support.js";

const T0 = "2026-08-27T00:00:00.000Z";
const T1 = "2026-08-27T00:01:00.000Z";
const T2 = "2026-08-27T00:10:00.000Z";
const T3 = "2026-08-27T00:11:00.000Z";
const EXPIRY = "2026-08-27T01:00:00.000Z";
const TARGET = Object.freeze({ path: "sandbox/target.txt" });

interface DecisionFixtureOverrides {
  readonly intent?: Readonly<Record<string, unknown>>;
  readonly id?: unknown;
}

function decisionFor(overrides: DecisionFixtureOverrides = {}) {
  const intent = createIntent({
    id: "intent.receipt.1",
    principal_id: "principal.operator",
    request: "Apply the declared disposable synthetic patch.",
    action: {
      adapter: "cint.adapter.synthetic-file-patch",
      type: "SYNTHETIC_FILE_PATCH",
      target: TARGET,
      parameters: { content: "after", expected_before_sha256: "0".repeat(64) },
      consequence: "CONSEQUENTIAL"
    },
    declared_effects: ["Replace the declared disposable target bytes"],
    context: { workspace: "synthetic-proof" },
    uncertainties: [],
    created_at: T0,
    ...overrides.intent
  });
  const principal = resolvePrincipal({
    id: "principal.operator",
    type: "HUMAN",
    authenticated: true,
    authority_chain: ["authority.receipt.1"],
    attributes: {},
    resolved_at: T0
  });
  const authority = createAuthorityGrant({
    id: "authority.receipt.1",
    principal_id: "principal.operator",
    issuer_id: "principal.authority",
    epoch: 1,
    grants: [
      {
        adapter: "cint.adapter.synthetic-file-patch",
        type: "SYNTHETIC_FILE_PATCH",
        target: TARGET
      }
    ],
    policy_ids: ["policy.receipt"],
    require_rollback: true,
    issued_at: T0,
    not_before: T0,
    expires_at: EXPIRY
  });
  const policy = createPolicySnapshot({
    id: "policy.receipt",
    version: "r0.1",
    epoch: 1,
    allowed_adapters: ["cint.adapter.synthetic-file-patch"],
    allowed_action_types: ["SYNTHETIC_FILE_PATCH"],
    denied_action_types: [],
    require_explicit_request: true,
    require_declared_effects: true,
    require_rollback_for_consequential: true,
    review_on_uncertainty: true,
    issued_at: T0
  });
  const adapter_capability = createAdapterCapability({
    id: "cint.adapter.synthetic-file-patch",
    action_types: ["SYNTHETIC_FILE_PATCH"],
    consequence_classes: ["CONSEQUENTIAL"],
    prepare_side_effect_free: true,
    rollback: true,
    interrupt: true,
    outcome_verification: true
  });
  const machine_state = createMachineStateSnapshot({
    id: "machine.synthetic",
    epoch: 1,
    available: true,
    state: { mode: "READY" },
    observed_at: T0
  });
  return decide({
    id: overrides.id ?? "decision.receipt.1",
    intent,
    principal,
    authority,
    policy,
    adapter_capability,
    machine_state,
    now: T1,
    expires_at: T2
  });
}

function receiptAuthority() {
  return new DecisionReceiptAuthority({
    issuer_id: "cint.receipt-authority.r0",
    key: Buffer.alloc(32, 7)
  });
}

function receiptFor(decision: AdmitDecision = requireAdmit(decisionFor())) {
  return receiptAuthority().issue({
    id: "receipt.demo.1",
    nonce: "receipt-nonce-0000000001",
    decision,
    issued_at: T1
  });
}

function reforge(record: object, changes: Readonly<Record<string, unknown>>) {
  const unsigned = {
    ...Object.fromEntries(Object.entries(record).filter(([key]) => key !== "digest")),
    ...changes
  };
  return { ...unsigned, digest: canonicalDigest(unsigned) };
}

async function withStore<Result>(run: (store: FileReceiptStore) => Promise<Result>): Promise<Result> {
  const root = await mkdtemp(path.join(os.tmpdir(), "cint-receipt-test-"));
  try {
    return await run(new FileReceiptStore(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const validRevalidation = async () => ({
  status: "VALID",
  reason_codes: [],
  digest: "a".repeat(64)
});

test("only an ADMIT decision can produce a receipt", () => {
  const denied = decisionFor({ intent: { request: null }, id: "decision.receipt.denied" });
  assert.equal(denied.status, "DENY");
  assert.throws(
    () => issueUntrusted(receiptAuthority(), { decision: denied, issued_at: T1 }),
    (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_DECISION_INELIGIBLE")
  );
});

test("receipt signature covers every decision binding", () => {
  const authority = receiptAuthority();
  const receipt = receiptFor();
  assert.equal(authority.verify(receipt, { now: T1 }), receipt);
  assert.equal(receipt.binding.action_digest.length, 64);
  assert.equal(receipt.binding.target_digest.length, 64);
  assert.equal(receipt.binding.context_digest.length, 64);
});

test("rehashed binding forgery fails the receipt signature", () => {
  const authority = receiptAuthority();
  const receipt = receiptFor();
  const binding = { ...receipt.binding, action_digest: "f".repeat(64) };
  const forged = reforge(receipt, {
    binding,
    binding_digest: canonicalDigest(binding)
  });
  assert.throws(
    () => authority.verify(forged, { now: T1 }),
    (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_SIGNATURE_INVALID")
  );
});

test("expired receipt verification is rejected", () => {
  assert.throws(
    () => receiptAuthority().verify(receiptFor(), { now: T2 }),
    (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_EXPIRED")
  );
});

test("registered receipt is consumed exactly once", async () => {
  await withStore(async (store) => {
    const receipt = receiptFor();
    await store.register(receipt, { registered_at: T1 });
    const consumed = await store.consume(receipt, { consumed_at: T1, revalidate: validRevalidation });
    assert.equal(consumed.state, "CONSUMED");
    assert.equal((await store.inspect(receipt.id)).state, "CONSUMED");
    await assert.rejects(
      store.consume(receipt, { consumed_at: T1, revalidate: validRevalidation }),
      (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_REPLAY_REJECTED")
    );
  });
});

test("parallel replay produces one atomic consumer", async () => {
  await withStore(async (store) => {
    const receipt = receiptFor();
    await store.register(receipt, { registered_at: T1 });
    const attempts = await Promise.allSettled([
      store.consume(receipt, { consumed_at: T1, revalidate: validRevalidation }),
      store.consume(receipt, { consumed_at: T1, revalidate: validRevalidation })
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    const rejected = attempts.find((attempt): attempt is PromiseRejectedResult => attempt.status === "rejected");
    assert.ok(rejected, "one replay attempt must reject");
    assert.ok(hasErrorCode(rejected.reason, "CINT_RECEIPT_REPLAY_REJECTED"));
  });
});

test("presented receipt must match the registered digest", async () => {
  await withStore(async (store) => {
    const receipt = receiptFor();
    await store.register(receipt, { registered_at: T1 });
    const other = receiptAuthority().issue({
      id: receipt.id,
      nonce: "receipt-nonce-0000000002",
      decision: requireAdmit(decisionFor()),
      issued_at: T1
    });
    await assert.rejects(
      store.consume(other, { consumed_at: T1, revalidate: validRevalidation }),
      (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_STORE_MISMATCH")
    );
  });
});

test("failed immediate revalidation terminally rejects the receipt", async () => {
  await withStore(async (store) => {
    const receipt = receiptFor();
    await store.register(receipt, { registered_at: T1 });
    await assert.rejects(
      store.consume(receipt, {
        consumed_at: T1,
        revalidate: async () => ({
          status: "REVOKED",
          reason_codes: ["CINT_POLICY_CHANGED"],
          digest: "b".repeat(64)
        })
      }),
      (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_REVOKED")
    );
    assert.equal((await store.inspect(receipt.id)).state, "REJECTED");
  });
});

test("receipt expiry at consumption is terminal and fail closed", async () => {
  await withStore(async (store) => {
    const receipt = receiptFor();
    await store.register(receipt, { registered_at: T1 });
    await assert.rejects(
      store.consume(receipt, { consumed_at: T3, revalidate: validRevalidation }),
      (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_REVOKED")
    );
    assert.equal((await store.inspect(receipt.id)).state, "REJECTED");
  });
});

test("ambiguous crash lock remains fail closed", async () => {
  await withStore(async (store) => {
    const receipt = receiptFor();
    await store.register(receipt, { registered_at: T1 });
    const lock = path.join(store.root, "locks", `${sha256(receipt.id)}.json.lock`);
    await writeFile(lock, "crash-residue", "utf8");
    await assert.rejects(
      store.consume(receipt, { consumed_at: T1, revalidate: validRevalidation }),
      (error: unknown) => hasErrorCode(error, "CINT_RECEIPT_REPLAY_REJECTED")
    );
    assert.equal((await store.inspect(receipt.id)).state, "LOCKED");
  });
});
