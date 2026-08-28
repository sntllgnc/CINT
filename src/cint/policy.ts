import {
  assertCint,
  assertExactKeys,
  identifier,
  integer,
  isoInstant,
  sealRecord,
  stringArray,
  verifyProtocolRecord
} from "./canonical.js";
import type { AdapterId, Epoch, Identifier, PolicyId } from "./types/brands.js";
import type {
  AdapterCapability,
  IntentRecord,
  PolicySnapshot
} from "./types/records.js";

const BOOLEAN_FIELDS = [
  "require_explicit_request",
  "require_declared_effects",
  "require_rollback_for_consequential",
  "review_on_uncertainty"
] as const;

export interface PolicyEvaluationInput {
  readonly policy: PolicySnapshot;
  readonly intent: IntentRecord;
  readonly adapter_capability: AdapterCapability;
}

export interface PolicyEvaluationResult {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

function checkedBoolean(value: unknown, field: string): boolean {
  assertCint(typeof value === "boolean", "CINT_POLICY_INVALID", `policy.${field} must be boolean`);
  return value;
}

export function createPolicySnapshot(value: unknown): PolicySnapshot {
  const input = assertExactKeys(
    value,
    [
      "id",
      "version",
      "epoch",
      "allowed_adapters",
      "allowed_action_types",
      "denied_action_types",
      "require_explicit_request",
      "require_declared_effects",
      "require_rollback_for_consequential",
      "review_on_uncertainty",
      "issued_at"
    ],
    [],
    "policy"
  );
  for (const field of BOOLEAN_FIELDS) {
    assertCint(typeof input[field] === "boolean", "CINT_POLICY_INVALID", `policy.${field} must be boolean`);
  }
  const allowedAdapters = stringArray(input["allowed_adapters"], "policy.allowed_adapters", {
    minimum: 1,
    maximum: 32,
    bytes: 128
  }).map((item) => identifier<AdapterId>(item, "policy.allowed_adapters item"));
  const allowedActionTypes = stringArray(input["allowed_action_types"], "policy.allowed_action_types", {
    minimum: 1,
    maximum: 64,
    bytes: 128
  }).map((item) => identifier<Identifier>(item, "policy.allowed_action_types item"));
  const deniedActionTypes = stringArray(input["denied_action_types"], "policy.denied_action_types", {
    minimum: 0,
    maximum: 64,
    bytes: 128
  }).map((item) => identifier<Identifier>(item, "policy.denied_action_types item"));
  assertCint(
    deniedActionTypes.every((item) => !allowedActionTypes.includes(item)),
    "CINT_POLICY_CONTRADICTION",
    "An action type cannot be both allowed and denied"
  );
  return sealRecord({
    protocol: "cint/policy/1" as const,
    id: identifier<PolicyId>(input["id"], "policy.id"),
    version: identifier<Identifier>(input["version"], "policy.version"),
    status: "ACTIVE" as const,
    epoch: integer<Epoch>(input["epoch"], "policy.epoch", { minimum: 1 }),
    allowed_adapters: allowedAdapters,
    allowed_action_types: allowedActionTypes,
    denied_action_types: deniedActionTypes,
    require_explicit_request: checkedBoolean(input["require_explicit_request"], "require_explicit_request"),
    require_declared_effects: checkedBoolean(input["require_declared_effects"], "require_declared_effects"),
    require_rollback_for_consequential: checkedBoolean(input["require_rollback_for_consequential"], "require_rollback_for_consequential"),
    review_on_uncertainty: checkedBoolean(input["review_on_uncertainty"], "review_on_uncertainty"),
    issued_at: isoInstant(input["issued_at"], "policy.issued_at")
  });
}

export function evaluatePolicy(input: PolicyEvaluationInput): PolicyEvaluationResult {
  const policy = verifyProtocolRecord(input.policy, "cint/policy/1", "policy");
  const intent = verifyProtocolRecord(input.intent, "cint/intent/1", "intent");
  const adapterCapability = verifyProtocolRecord(
    input.adapter_capability,
    "cint/adapter-capability/1",
    "adapter capability"
  );
  const reasons: string[] = [];
  if (policy.status !== "ACTIVE") reasons.push("CINT_POLICY_INACTIVE");
  if (!policy.allowed_adapters.includes(intent.action.adapter)) reasons.push("CINT_POLICY_ADAPTER_DENIED");
  if (!policy.allowed_action_types.includes(intent.action.type)) reasons.push("CINT_POLICY_ACTION_DENIED");
  if (policy.denied_action_types.includes(intent.action.type)) reasons.push("CINT_POLICY_ACTION_DENIED");
  if (!adapterCapability.action_types.includes(intent.action.type)) reasons.push("CINT_ADAPTER_ACTION_UNSUPPORTED");
  if (!adapterCapability.consequence_classes.includes(intent.action.consequence)) {
    reasons.push("CINT_ADAPTER_CONSEQUENCE_UNSUPPORTED");
  }
  if (
    intent.action.consequence === "CONSEQUENTIAL" &&
    policy.require_rollback_for_consequential &&
    !adapterCapability.rollback
  ) {
    reasons.push("CINT_ROLLBACK_REQUIRED");
  }
  return { allowed: reasons.length === 0, reasons };
}
