import {
  assertCint,
  assertExactKeys,
  assertJsonValue,
  identifier,
  isPlainRecord,
  isoInstant,
  sealRecord,
  stringArray
} from "./canonical.js";
import type { AuthorityId, PrincipalId } from "./types/brands.js";
import type { JsonObject, JsonValue } from "./types/protocols.js";
import type { PrincipalRecord, PrincipalType } from "./types/records.js";

const PRINCIPAL_TYPES: ReadonlySet<string> = new Set(["HUMAN", "SERVICE", "AGENT"]);

function isPrincipalType(value: string): value is PrincipalType {
  return PRINCIPAL_TYPES.has(value);
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return isPlainRecord(value);
}

export function resolvePrincipal(value: unknown): PrincipalRecord {
  const input = assertExactKeys(
    value,
    ["id", "type", "authenticated", "authority_chain", "attributes", "resolved_at"],
    [],
    "principal"
  );
  const type = String(input["type"]);
  assertCint(isPrincipalType(type), "CINT_PRINCIPAL_TYPE", `Unsupported principal type: ${type}`);
  assertCint(typeof input["authenticated"] === "boolean", "CINT_PRINCIPAL_AUTH", "principal.authenticated must be boolean");
  const authorityChain = stringArray(input["authority_chain"], "principal.authority_chain", {
    minimum: 0,
    maximum: 16,
    bytes: 128
  }).map((item) => identifier<AuthorityId>(item, "principal.authority_chain item"));
  const attributes = assertJsonValue(input["attributes"], "principal.attributes");
  assertCint(isJsonObject(attributes), "CINT_SCHEMA_INVALID", "principal.attributes must be an object");
  return sealRecord({
    protocol: "cint/principal/1" as const,
    id: identifier<PrincipalId>(input["id"], "principal.id"),
    type,
    authenticated: input["authenticated"],
    authority_chain: authorityChain,
    attributes,
    resolved_at: isoInstant(input["resolved_at"], "principal.resolved_at")
  });
}
