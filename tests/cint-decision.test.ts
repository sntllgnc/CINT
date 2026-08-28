import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalDigest,
  canonicalJson,
  createAdapterCapability,
  createAuthorityGrant,
  createIntent,
  createMachineStateSnapshot,
  createPolicySnapshot,
  createStateMachine,
  decide,
  parseCanonicalJson,
  resolvePrincipal,
  sealRecord,
  transitionState
} from "../src/cint/index.js";
import { hasErrorCode, hasReason } from "./cint-test-support.js";

const T0 = "2026-08-27T00:00:00.000Z";
const T1 = "2026-08-27T00:01:00.000Z";
const T2 = "2026-08-27T00:10:00.000Z";
const EXPIRY = "2026-08-27T01:00:00.000Z";
const TARGET = Object.freeze({ path: "sandbox/target.txt" });

type RecordPatch = Readonly<Record<string, unknown>>;

interface RecordOverrides {
  readonly intent?: RecordPatch;
  readonly principal?: RecordPatch;
  readonly authority?: RecordPatch;
  readonly policy?: RecordPatch;
  readonly adapter_capability?: RecordPatch;
  readonly machine_state?: RecordPatch;
}

interface DecisionOverrides {
  readonly id?: unknown;
  readonly now?: unknown;
  readonly expires_at?: unknown;
}

function records(overrides: RecordOverrides = {}) {
  const intent = createIntent({
    id: "intent.demo.1",
    principal_id: "principal.operator",
    request: "Replace the disposable synthetic target with the declared content.",
    action: {
      adapter: "cint.adapter.synthetic-file-patch",
      type: "SYNTHETIC_FILE_PATCH",
      target: TARGET,
      parameters: { content: "after", expected_before_sha256: "0".repeat(64) },
      consequence: "CONSEQUENTIAL"
    },
    declared_effects: ["Replace bytes in the declared disposable target"],
    context: { workspace: "synthetic-proof" },
    uncertainties: [],
    created_at: T0,
    ...overrides.intent
  });
  const principal = resolvePrincipal({
    id: "principal.operator",
    type: "HUMAN",
    authenticated: true,
    authority_chain: ["authority.demo.1"],
    attributes: { role: "operator" },
    resolved_at: T0,
    ...overrides.principal
  });
  const authority = createAuthorityGrant({
    id: "authority.demo.1",
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
    policy_ids: ["policy.demo"],
    require_rollback: true,
    issued_at: T0,
    not_before: T0,
    expires_at: EXPIRY,
    ...overrides.authority
  });
  const policy = createPolicySnapshot({
    id: "policy.demo",
    version: "r0.1",
    epoch: 1,
    allowed_adapters: ["cint.adapter.synthetic-file-patch"],
    allowed_action_types: ["SYNTHETIC_FILE_PATCH"],
    denied_action_types: [],
    require_explicit_request: true,
    require_declared_effects: true,
    require_rollback_for_consequential: true,
    review_on_uncertainty: true,
    issued_at: T0,
    ...overrides.policy
  });
  const adapter_capability = createAdapterCapability({
    id: "cint.adapter.synthetic-file-patch",
    action_types: ["SYNTHETIC_FILE_PATCH"],
    consequence_classes: ["CONSEQUENTIAL"],
    prepare_side_effect_free: true,
    rollback: true,
    interrupt: true,
    outcome_verification: true,
    ...overrides.adapter_capability
  });
  const machine_state = createMachineStateSnapshot({
    id: "machine.synthetic",
    epoch: 1,
    available: true,
    state: { mode: "READY", target_locked: false },
    observed_at: T0,
    ...overrides.machine_state
  });
  return { intent, principal, authority, policy, adapter_capability, machine_state };
}

function decideRecords(values: object, overrides: DecisionOverrides = {}) {
  return decide({
    id: overrides.id ?? "decision.demo.1",
    ...values,
    now: overrides.now ?? T1,
    expires_at: overrides.expires_at ?? T2
  });
}

function rehashRecord(record: object, overrides: RecordPatch) {
  const unsigned = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "digest"));
  const changed = { ...unsigned, ...overrides };
  return { ...changed, digest: canonicalDigest(changed) };
}

test("canonical parser admits only the canonical byte representation", () => {
  const value = { z: 1, a: [true, null] };
  assert.deepEqual(parseCanonicalJson(canonicalJson(value)), { a: [true, null], z: 1 });
  assert.throws(
    () => parseCanonicalJson(JSON.stringify(value, null, 2)),
    (error: unknown) => hasErrorCode(error, "CINT_JSON_NOT_CANONICAL")
  );
});

test("strict intent construction rejects unknown fields", () => {
  assert.throws(
    () => records({ intent: { undeclared_field: true } }),
    (error: unknown) => hasErrorCode(error, "CINT_UNKNOWN_FIELD")
  );
});

test("exact current bindings produce ADMIT without executable authority", () => {
  const decision = decideRecords(records());
  assert.equal(decision.status, "ADMIT");
  assert.equal(decision.receipt_eligible, true);
  assert.equal(decision.execution_authority, "NONE");
  assert.equal(decision.reason_codes.length, 0);
});

test("silent request is denied", () => {
  const decision = decideRecords(records({ intent: { request: null } }));
  assert.equal(decision.status, "DENY");
  assert(hasReason(decision, "CINT_SILENT_REQUEST"));
});

test("undeclared effect is denied", () => {
  const decision = decideRecords(records({ intent: { declared_effects: [] } }));
  assert.equal(decision.status, "DENY");
  assert(hasReason(decision, "CINT_EFFECT_UNDECLARED"));
});

test("target outside the exact authority binding is denied", () => {
  const values = records({
    intent: {
      action: {
        adapter: "cint.adapter.synthetic-file-patch",
        type: "SYNTHETIC_FILE_PATCH",
        target: { path: "sandbox/other.txt" },
        parameters: { content: "after", expected_before_sha256: "0".repeat(64) },
        consequence: "CONSEQUENTIAL"
      }
    }
  });
  const decision = decideRecords(values);
  assert.equal(decision.status, "DENY");
  assert(hasReason(decision, "CINT_AUTHORITY_ACTION_DENIED"));
});

test("unresolved counter-intent requires REVIEW", () => {
  const decision = decideRecords(records({ intent: { uncertainties: ["Target ownership needs confirmation"] } }));
  assert.equal(decision.status, "REVIEW");
  assert.equal(decision.receipt_eligible, false);
  assert(hasReason(decision, "CINT_COUNTER_INTENT_UNRESOLVED"));
});

test("unavailable CINT machine state fails closed", () => {
  const decision = decideRecords(records({ machine_state: { available: false } }));
  assert.equal(decision.status, "DENY");
  assert(hasReason(decision, "CINT_UNAVAILABLE"));
});

test("consequential action without rollback capability is denied", () => {
  const decision = decideRecords(records({ adapter_capability: { rollback: false } }));
  assert.equal(decision.status, "DENY");
  assert(hasReason(decision, "CINT_ROLLBACK_REQUIRED"));
});

test("tampered sealed input cannot reach a decision", () => {
  const values = records();
  const tamperedIntent = { ...values.intent, request: "Different request" };
  assert.throws(
    () => decideRecords({ ...values, intent: tamperedIntent }),
    (error: unknown) => hasErrorCode(error, "CINT_RECORD_TAMPERED")
  );
});

test("rehashed authority with an alien protocol cannot reach ADMIT", () => {
  const current = records();
  const { digest, ...unsigned } = current.authority;
  const forged = sealRecord({
    ...unsigned,
    protocol: "not-cint/authority/999",
    schema_forbidden_field: true
  });
  assert.throws(
    () => decideRecords({ ...current, authority: forged }, { id: "decision.schema-invalid-authority" }),
    (error: unknown) => hasErrorCode(error, "CINT_PROTOCOL_INVALID")
  );
});

test("adapter capability and machine state require exact protocols and fields", () => {
  const current = records();
  for (const [field, alienProtocol] of [
    ["adapter_capability", "not-cint/adapter-capability/999"],
    ["machine_state", "not-cint/machine-state/999"]
  ] as const) {
    const alien = rehashRecord(current[field], { protocol: alienProtocol, forbidden_field: true });
    assert.throws(
      () => decideRecords({ ...current, [field]: alien }, { id: `decision.alien.${field}` }),
      (error: unknown) => hasErrorCode(error, "CINT_PROTOCOL_INVALID"),
      field
    );
    const extraField = rehashRecord(current[field], { forbidden_field: true });
    assert.throws(
      () => decideRecords({ ...current, [field]: extraField }, { id: `decision.extra.${field}` }),
      (error: unknown) => hasErrorCode(error, "CINT_SCHEMA_INVALID"),
      field
    );
  }
});

test("decision cannot outlive its authority", () => {
  assert.throws(
    () => decideRecords(records(), { expires_at: "2026-08-27T02:00:00.000Z" }),
    (error: unknown) => hasErrorCode(error, "CINT_DECISION_TIME")
  );
});

test("state machine permits only declared transitions", () => {
  const requested = createStateMachine({ id: "state.demo.1", subject_id: "intent.demo.1", created_at: T0 });
  const challenged = transitionState(requested, { state: "CHALLENGED", at: T1, evidence_digest: null });
  const admitted = transitionState(challenged, { state: "ADMITTED", at: T2, evidence_digest: null });
  assert.equal(admitted.state, "ADMITTED");
  assert.throws(
    () => transitionState(admitted, { state: "EXECUTING", at: T2, evidence_digest: null }),
    (error: unknown) => hasErrorCode(error, "CINT_STATE_TRANSITION")
  );
});
