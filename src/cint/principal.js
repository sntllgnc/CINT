import {
  assertCint,
  assertExactKeys,
  assertJsonValue,
  identifier,
  isoInstant,
  sealRecord,
  stringArray
} from "./canonical.js";

const PRINCIPAL_TYPES = new Set(["HUMAN", "SERVICE", "AGENT"]);

export function resolvePrincipal(input) {
  assertExactKeys(
    input,
    ["id", "type", "authenticated", "authority_chain", "attributes", "resolved_at"],
    [],
    "principal"
  );
  const type = String(input.type);
  assertCint(PRINCIPAL_TYPES.has(type), "CINT_PRINCIPAL_TYPE", `Unsupported principal type: ${type}`);
  assertCint(typeof input.authenticated === "boolean", "CINT_PRINCIPAL_AUTH", "principal.authenticated must be boolean");
  const authorityChain = stringArray(input.authority_chain, "principal.authority_chain", {
    minimum: 0,
    maximum: 16,
    bytes: 128
  }).map((value) => identifier(value, "principal.authority_chain item"));
  return sealRecord({
    protocol: "cint/principal/1",
    id: identifier(input.id, "principal.id"),
    type,
    authenticated: input.authenticated,
    authority_chain: authorityChain,
    attributes: assertJsonValue(input.attributes, "principal.attributes"),
    resolved_at: isoInstant(input.resolved_at, "principal.resolved_at")
  });
}
