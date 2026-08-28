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
import type {
  ActionDigest,
  AdapterId,
  ContextDigest,
  Identifier,
  IntentId,
  PrincipalId,
  TargetDigest
} from "./types/brands.js";
import type { CintAction, ConsequenceClass, IntentRecord } from "./types/records.js";

const CONSEQUENCE_CLASSES: ReadonlySet<string> = new Set(["READ_ONLY", "CONSEQUENTIAL"]);

function isConsequenceClass(value: string): value is ConsequenceClass {
  return CONSEQUENCE_CLASSES.has(value);
}

function actionRecord(value: unknown): CintAction {
  const input = assertExactKeys(value, ["adapter", "type", "target", "parameters", "consequence"], [], "intent.action");
  const consequence = boundedString(input["consequence"], "intent.action.consequence", { minimum: 8, maximum: 32 });
  assertCint(
    isConsequenceClass(consequence),
    "CINT_CONSEQUENCE_INVALID",
    `Unsupported consequence class: ${consequence}`
  );
  return immutableRecord({
    adapter: identifier<AdapterId>(input["adapter"], "intent.action.adapter"),
    type: identifier<Identifier>(input["type"], "intent.action.type"),
    target: assertJsonValue(input["target"], "intent.action.target"),
    parameters: assertJsonValue(input["parameters"], "intent.action.parameters"),
    consequence
  });
}

export function createIntent(value: unknown): IntentRecord {
  const input = assertExactKeys(
    value,
    ["id", "principal_id", "request", "action", "declared_effects", "context", "uncertainties", "created_at"],
    [],
    "intent"
  );
  const action = actionRecord(input["action"]);
  const context = assertJsonValue(input["context"], "intent.context");
  const record = {
    protocol: "cint/intent/1" as const,
    id: identifier<IntentId>(input["id"], "intent.id"),
    principal_id: identifier<PrincipalId>(input["principal_id"], "intent.principal_id"),
    request:
      input["request"] === null
        ? null
        : boundedString(input["request"], "intent.request", { minimum: 1, maximum: 8192 }),
    action,
    declared_effects: stringArray(input["declared_effects"], "intent.declared_effects", {
      minimum: 0,
      maximum: 32,
      bytes: 512
    }),
    context,
    uncertainties: stringArray(input["uncertainties"], "intent.uncertainties", {
      minimum: 0,
      maximum: 16,
      bytes: 512
    }),
    created_at: isoInstant(input["created_at"], "intent.created_at"),
    action_digest: canonicalDigest<ActionDigest>(action),
    target_digest: canonicalDigest<TargetDigest>(action.target),
    context_digest: canonicalDigest<ContextDigest>(context)
  };
  return sealRecord(record);
}

export function reconstructIntent(input: unknown): IntentRecord {
  return createIntent(input);
}
