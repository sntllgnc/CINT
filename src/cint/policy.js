import {
  assertCint,
  assertExactKeys,
  identifier,
  integer,
  isoInstant,
  sealRecord,
  stringArray,
  verifySealedRecord
} from "./canonical.js";

export function createPolicySnapshot(input) {
  assertExactKeys(
    input,
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
  for (const field of [
    "require_explicit_request",
    "require_declared_effects",
    "require_rollback_for_consequential",
    "review_on_uncertainty"
  ]) {
    assertCint(typeof input[field] === "boolean", "CINT_POLICY_INVALID", `policy.${field} must be boolean`);
  }
  const allowedAdapters = stringArray(input.allowed_adapters, "policy.allowed_adapters", {
    minimum: 1,
    maximum: 32,
    bytes: 128
  }).map((value) => identifier(value, "policy.allowed_adapters item"));
  const allowedActionTypes = stringArray(input.allowed_action_types, "policy.allowed_action_types", {
    minimum: 1,
    maximum: 64,
    bytes: 128
  }).map((value) => identifier(value, "policy.allowed_action_types item"));
  const deniedActionTypes = stringArray(input.denied_action_types, "policy.denied_action_types", {
    minimum: 0,
    maximum: 64,
    bytes: 128
  }).map((value) => identifier(value, "policy.denied_action_types item"));
  assertCint(
    deniedActionTypes.every((value) => !allowedActionTypes.includes(value)),
    "CINT_POLICY_CONTRADICTION",
    "An action type cannot be both allowed and denied"
  );
  return sealRecord({
    protocol: "cint/policy/1",
    id: identifier(input.id, "policy.id"),
    version: identifier(input.version, "policy.version"),
    status: "ACTIVE",
    epoch: integer(input.epoch, "policy.epoch", { minimum: 1 }),
    allowed_adapters: allowedAdapters,
    allowed_action_types: allowedActionTypes,
    denied_action_types: deniedActionTypes,
    require_explicit_request: input.require_explicit_request,
    require_declared_effects: input.require_declared_effects,
    require_rollback_for_consequential: input.require_rollback_for_consequential,
    review_on_uncertainty: input.review_on_uncertainty,
    issued_at: isoInstant(input.issued_at, "policy.issued_at")
  });
}

export function evaluatePolicy({ policy, intent, adapter_capability }) {
  verifySealedRecord(policy, "policy");
  verifySealedRecord(intent, "intent");
  verifySealedRecord(adapter_capability, "adapter capability");
  const reasons = [];
  if (policy.status !== "ACTIVE") reasons.push("CINT_POLICY_INACTIVE");
  if (!policy.allowed_adapters.includes(intent.action.adapter)) reasons.push("CINT_POLICY_ADAPTER_DENIED");
  if (!policy.allowed_action_types.includes(intent.action.type)) reasons.push("CINT_POLICY_ACTION_DENIED");
  if (policy.denied_action_types.includes(intent.action.type)) reasons.push("CINT_POLICY_ACTION_DENIED");
  if (!adapter_capability.action_types.includes(intent.action.type)) reasons.push("CINT_ADAPTER_ACTION_UNSUPPORTED");
  if (!adapter_capability.consequence_classes.includes(intent.action.consequence)) {
    reasons.push("CINT_ADAPTER_CONSEQUENCE_UNSUPPORTED");
  }
  if (
    intent.action.consequence === "CONSEQUENTIAL" &&
    policy.require_rollback_for_consequential &&
    !adapter_capability.rollback
  ) {
    reasons.push("CINT_ROLLBACK_REQUIRED");
  }
  return { allowed: reasons.length === 0, reasons };
}
