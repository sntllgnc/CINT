import {
  assertCint,
  assertExactKeys,
  identifier,
  isoInstant,
  sealRecord,
  stringArray,
  verifySealedRecord
} from "./canonical.js";
import { evaluateAuthority } from "./authority.js";
import { evaluatePolicy } from "./policy.js";

const CONSEQUENCE_CLASSES = new Set(["READ_ONLY", "CONSEQUENTIAL"]);

function challengeReason(code, disposition, message) {
  return { code, disposition, message };
}

export function createAdapterCapability(input) {
  assertExactKeys(
    input,
    ["id", "action_types", "consequence_classes", "rollback", "interrupt", "outcome_verification"],
    [],
    "adapter capability"
  );
  for (const field of ["rollback", "interrupt", "outcome_verification"]) {
    assertCint(typeof input[field] === "boolean", "CINT_ADAPTER_CAPABILITY_INVALID", `adapter capability ${field} must be boolean`);
  }
  const consequenceClasses = stringArray(input.consequence_classes, "adapter consequence classes", {
    minimum: 1,
    maximum: 2,
    bytes: 32
  });
  assertCint(
    consequenceClasses.every((value) => CONSEQUENCE_CLASSES.has(value)),
    "CINT_ADAPTER_CAPABILITY_INVALID",
    "adapter capability has an unknown consequence class"
  );
  return sealRecord({
    protocol: "cint/adapter-capability/1",
    id: identifier(input.id, "adapter capability id"),
    action_types: stringArray(input.action_types, "adapter action types", {
      minimum: 1,
      maximum: 64,
      bytes: 128
    }).map((value) => identifier(value, "adapter action type")),
    consequence_classes: consequenceClasses,
    rollback: input.rollback,
    interrupt: input.interrupt,
    outcome_verification: input.outcome_verification
  });
}

export function runCounterIntentChallenge({
  intent,
  principal,
  authority,
  policy,
  adapter_capability,
  machine_state,
  now
}) {
  for (const [label, record] of Object.entries({
    intent,
    principal,
    authority,
    policy,
    adapter_capability,
    machine_state
  })) {
    verifySealedRecord(record, label);
  }
  const checkedAt = isoInstant(now, "challenge time");
  const reasons = [];
  if (!machine_state.available) {
    reasons.push(challengeReason("CINT_UNAVAILABLE", "DENY", "Current machine state is unavailable"));
  }
  if (!principal.authenticated) {
    reasons.push(challengeReason("CINT_PRINCIPAL_UNAUTHENTICATED", "DENY", "Principal is not authenticated"));
  }
  if (principal.id !== intent.principal_id) {
    reasons.push(challengeReason("CINT_PRINCIPAL_MISMATCH", "DENY", "Resolved principal does not own the intent"));
  }
  if (principal.authority_chain.length > 0 && !principal.authority_chain.includes(authority.id)) {
    reasons.push(challengeReason("CINT_AUTHORITY_CHAIN_MISMATCH", "DENY", "Authority is absent from the principal chain"));
  }
  if (adapter_capability.id !== intent.action.adapter) {
    reasons.push(challengeReason("CINT_ADAPTER_MISMATCH", "DENY", "Intent names a different adapter"));
  }
  if (policy.require_explicit_request && intent.request === null) {
    reasons.push(challengeReason("CINT_SILENT_REQUEST", "DENY", "No explicit principal request authorizes the action"));
  }
  if (policy.require_declared_effects && intent.declared_effects.length === 0) {
    reasons.push(challengeReason("CINT_EFFECT_UNDECLARED", "DENY", "Consequential effects were not declared"));
  }
  const authorityResult = evaluateAuthority({ authority, intent, policy, now: checkedAt });
  for (const code of authorityResult.reasons) {
    reasons.push(challengeReason(code, "DENY", "Current authority does not admit the exact action binding"));
  }
  const policyResult = evaluatePolicy({ policy, intent, adapter_capability });
  for (const code of policyResult.reasons) {
    reasons.push(challengeReason(code, "DENY", "Current policy or adapter capability rejects the action"));
  }
  if (authority.require_rollback && intent.action.consequence === "CONSEQUENTIAL" && !adapter_capability.rollback) {
    reasons.push(challengeReason("CINT_AUTHORITY_ROLLBACK_REQUIRED", "DENY", "Authority requires a rollback-capable adapter"));
  }
  if (policy.review_on_uncertainty && intent.uncertainties.length > 0) {
    reasons.push(challengeReason("CINT_COUNTER_INTENT_UNRESOLVED", "REVIEW", "Intent contains unresolved counter-intent"));
  }
  const status = reasons.some((reason) => reason.disposition === "DENY")
    ? "DENIED"
    : reasons.some((reason) => reason.disposition === "REVIEW")
      ? "REVIEW"
      : "CLEAR";
  return sealRecord({
    protocol: "cint/challenge/1",
    status,
    checked_at: checkedAt,
    intent_digest: intent.digest,
    principal_digest: principal.digest,
    authority_digest: authority.digest,
    policy_digest: policy.digest,
    adapter_capability_digest: adapter_capability.digest,
    machine_state_digest: machine_state.state_digest,
    reasons
  });
}
