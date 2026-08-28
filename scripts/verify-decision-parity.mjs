import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [baselineRoot, candidateRoot] = process.argv.slice(2);
assert.ok(baselineRoot && candidateRoot, "usage: verify-decision-parity.mjs <baseline-root> <candidate-root>");

const T0 = "2026-08-27T00:00:00.000Z";
const T1 = "2026-08-27T00:01:00.000Z";
const T2 = "2026-08-27T00:10:00.000Z";
const EXPIRY = "2026-08-27T01:00:00.000Z";
const TARGET = Object.freeze({ path: "sandbox/target.txt" });

async function loadApi(root) {
  const entry = pathToFileURL(path.join(path.resolve(root), "src", "cint", "index.js")).href;
  return import(entry);
}

function records(api, intentOverrides = {}) {
  const intent = api.createIntent({
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
    ...intentOverrides
  });
  const principal = api.resolvePrincipal({
    id: "principal.operator",
    type: "HUMAN",
    authenticated: true,
    authority_chain: ["authority.demo.1"],
    attributes: { role: "operator" },
    resolved_at: T0
  });
  const authority = api.createAuthorityGrant({
    id: "authority.demo.1",
    principal_id: "principal.operator",
    issuer_id: "principal.authority",
    epoch: 1,
    grants: [{ adapter: "cint.adapter.synthetic-file-patch", type: "SYNTHETIC_FILE_PATCH", target: TARGET }],
    policy_ids: ["policy.demo"],
    require_rollback: true,
    issued_at: T0,
    not_before: T0,
    expires_at: EXPIRY
  });
  const policy = api.createPolicySnapshot({
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
    issued_at: T0
  });
  const adapter_capability = api.createAdapterCapability({
    id: "cint.adapter.synthetic-file-patch",
    action_types: ["SYNTHETIC_FILE_PATCH"],
    consequence_classes: ["CONSEQUENTIAL"],
    prepare_side_effect_free: true,
    rollback: true,
    interrupt: true,
    outcome_verification: true
  });
  const machine_state = api.createMachineStateSnapshot({
    id: "machine.synthetic",
    epoch: 1,
    available: true,
    state: { mode: "READY", target_locked: false },
    observed_at: T0
  });
  return { intent, principal, authority, policy, adapter_capability, machine_state };
}

function decision(api, values, id) {
  return api.decide({ id, ...values, now: T1, expires_at: T2 });
}

async function vector(root) {
  const api = await loadApi(root);
  return {
    admit: decision(api, records(api), "decision.parity.admit"),
    deny: decision(api, records(api, { request: null }), "decision.parity.deny"),
    review: decision(api, records(api, { uncertainties: ["operator confirmation pending"] }), "decision.parity.review")
  };
}

const baseline = await vector(baselineRoot);
const candidate = await vector(candidateRoot);
assert.deepEqual(candidate, baseline, "compiled decision vectors differ from v0.1.0-cint-r0");

console.log(JSON.stringify({
  gate: "CINT-R1-GOLDEN-DECISION-PARITY",
  verdict: "PASS",
  scenarios: ["ADMIT", "DENY", "REVIEW"],
  digests: {
    admit: candidate.admit.digest,
    deny: candidate.deny.digest,
    review: candidate.review.digest
  }
}, null, 2));
