import {
  assertCint,
  assertExactKeys,
  assertJsonValue,
  boundedString,
  canonicalDigest,
  identifier,
  immutableRecord,
  isoInstant,
  sealRecord,
  stringArray
} from "./canonical.js";

const CONSEQUENCE_CLASSES = new Set(["READ_ONLY", "CONSEQUENTIAL"]);

function actionRecord(value) {
  assertExactKeys(value, ["adapter", "type", "target", "parameters", "consequence"], [], "intent.action");
  const action = {
    adapter: identifier(value.adapter, "intent.action.adapter"),
    type: identifier(value.type, "intent.action.type"),
    target: assertJsonValue(value.target, "intent.action.target"),
    parameters: assertJsonValue(value.parameters, "intent.action.parameters"),
    consequence: boundedString(value.consequence, "intent.action.consequence", { minimum: 8, maximum: 32 })
  };
  assertCint(
    CONSEQUENCE_CLASSES.has(action.consequence),
    "CINT_CONSEQUENCE_INVALID",
    `Unsupported consequence class: ${action.consequence}`
  );
  return immutableRecord(action);
}

export function createIntent(input) {
  assertExactKeys(
    input,
    ["id", "principal_id", "request", "action", "declared_effects", "context", "uncertainties", "created_at"],
    [],
    "intent"
  );
  const action = actionRecord(input.action);
  const record = {
    protocol: "cint/intent/1",
    id: identifier(input.id, "intent.id"),
    principal_id: identifier(input.principal_id, "intent.principal_id"),
    request:
      input.request === null
        ? null
        : boundedString(input.request, "intent.request", { minimum: 1, maximum: 8192 }),
    action,
    declared_effects: stringArray(input.declared_effects, "intent.declared_effects", {
      minimum: 0,
      maximum: 32,
      bytes: 512
    }),
    context: assertJsonValue(input.context, "intent.context"),
    uncertainties: stringArray(input.uncertainties, "intent.uncertainties", {
      minimum: 0,
      maximum: 16,
      bytes: 512
    }),
    created_at: isoInstant(input.created_at, "intent.created_at"),
    action_digest: canonicalDigest(action),
    target_digest: canonicalDigest(action.target),
    context_digest: canonicalDigest(input.context)
  };
  return sealRecord(record);
}

export function reconstructIntent(input) {
  return createIntent(input);
}
