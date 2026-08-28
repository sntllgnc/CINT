import {
  assertCint,
  assertExactKeys,
  identifier,
  isoInstant,
  sealRecord,
  stringArray,
  verifyProtocolRecord
} from "./canonical.js";
import { evaluateAuthority } from "./authority.js";
import { evaluatePolicy } from "./policy.js";
import type { AdapterId, Identifier } from "./types/brands.js";
import type {
  AdapterCapability,
  AuthorityRecord,
  ChallengeReason,
  ChallengeRecord,
  ConsequenceClass,
  IntentRecord,
  MachineStateSnapshot,
  PolicySnapshot,
  PrincipalRecord
} from "./types/records.js";

const CONSEQUENCE_CLASSES: ReadonlySet<string> = new Set(["READ_ONLY", "CONSEQUENTIAL"]);
const CAPABILITY_FLAGS = ["prepare_side_effect_free", "rollback", "interrupt", "outcome_verification"] as const;

function areConsequenceClasses(values: readonly string[]): values is readonly ConsequenceClass[] {
  return values.every((item) => CONSEQUENCE_CLASSES.has(item));
}

function capabilityBoolean(value: unknown, field: string): boolean {
  assertCint(typeof value === "boolean", "CINT_ADAPTER_CAPABILITY_INVALID", `adapter capability ${field} must be boolean`);
  return value;
}

export interface CounterIntentChallengeInput {
  readonly intent: IntentRecord;
  readonly principal: PrincipalRecord;
  readonly authority: AuthorityRecord;
  readonly policy: PolicySnapshot;
  readonly adapter_capability: AdapterCapability;
  readonly machine_state: MachineStateSnapshot;
  readonly now: unknown;
}

function challengeReason(code: string, disposition: "DENY" | "REVIEW", message: string): ChallengeReason {
  return { code: identifier<Identifier>(code, "challenge reason code"), disposition, message };
}

export function createAdapterCapability(value: unknown): AdapterCapability {
  const input = assertExactKeys(
    value,
    [
      "id",
      "action_types",
      "consequence_classes",
      "prepare_side_effect_free",
      "rollback",
      "interrupt",
      "outcome_verification"
    ],
    [],
    "adapter capability"
  );
  for (const field of CAPABILITY_FLAGS) {
    assertCint(typeof input[field] === "boolean", "CINT_ADAPTER_CAPABILITY_INVALID", `adapter capability ${field} must be boolean`);
  }
  const consequenceClasses = stringArray(input["consequence_classes"], "adapter consequence classes", {
    minimum: 1,
    maximum: 2,
    bytes: 32
  });
  assertCint(
    areConsequenceClasses(consequenceClasses),
    "CINT_ADAPTER_CAPABILITY_INVALID",
    "adapter capability has an unknown consequence class"
  );
  return sealRecord({
    protocol: "cint/adapter-capability/1" as const,
    id: identifier<AdapterId>(input["id"], "adapter capability id"),
    action_types: stringArray(input["action_types"], "adapter action types", {
      minimum: 1,
      maximum: 64,
      bytes: 128
    }).map((item) => identifier<Identifier>(item, "adapter action type")),
    consequence_classes: consequenceClasses,
    prepare_side_effect_free: capabilityBoolean(input["prepare_side_effect_free"], "prepare_side_effect_free"),
    rollback: capabilityBoolean(input["rollback"], "rollback"),
    interrupt: capabilityBoolean(input["interrupt"], "interrupt"),
    outcome_verification: capabilityBoolean(input["outcome_verification"], "outcome_verification")
  });
}

export function runCounterIntentChallenge(input: CounterIntentChallengeInput): ChallengeRecord {
  const intent = verifyProtocolRecord(input.intent, "cint/intent/1", "intent");
  const principal = verifyProtocolRecord(input.principal, "cint/principal/1", "principal");
  const authority = verifyProtocolRecord(input.authority, "cint/authority/1", "authority");
  const policy = verifyProtocolRecord(input.policy, "cint/policy/1", "policy");
  const adapterCapability = verifyProtocolRecord(
    input.adapter_capability,
    "cint/adapter-capability/1",
    "adapter capability"
  );
  const machineState = verifyProtocolRecord(input.machine_state, "cint/machine-state/1", "machine state");
  const checkedAt = isoInstant(input.now, "challenge time");
  const reasons: ChallengeReason[] = [];
  if (!machineState.available) {
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
  if (adapterCapability.id !== intent.action.adapter) {
    reasons.push(challengeReason("CINT_ADAPTER_MISMATCH", "DENY", "Intent names a different adapter"));
  }
  if (adapterCapability.prepare_side_effect_free !== true) {
    reasons.push(challengeReason("CINT_ADAPTER_PREPARE_UNSAFE", "DENY", "Adapter preparation is not side-effect-free"));
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
  const policyResult = evaluatePolicy({ policy, intent, adapter_capability: adapterCapability });
  for (const code of policyResult.reasons) {
    reasons.push(challengeReason(code, "DENY", "Current policy or adapter capability rejects the action"));
  }
  if (authority.require_rollback && intent.action.consequence === "CONSEQUENTIAL" && !adapterCapability.rollback) {
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
    protocol: "cint/challenge/1" as const,
    status,
    checked_at: checkedAt,
    intent_digest: intent.digest,
    principal_digest: principal.digest,
    authority_digest: authority.digest,
    policy_digest: policy.digest,
    adapter_capability_digest: adapterCapability.digest,
    machine_state_digest: machineState.state_digest,
    reasons
  });
}
