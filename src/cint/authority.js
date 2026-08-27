import {
  assertCint,
  assertExactKeys,
  assertJsonValue,
  boundedString,
  canonicalDigest,
  identifier,
  integer,
  isoInstant,
  sealRecord,
  stringArray,
  verifySealedRecord
} from "./canonical.js";

function grantRecord(value, index) {
  assertExactKeys(value, ["adapter", "type", "target"], [], `authority.grants[${index}]`);
  return {
    adapter: identifier(value.adapter, `authority.grants[${index}].adapter`),
    type: identifier(value.type, `authority.grants[${index}].type`),
    target_digest: canonicalDigest(assertJsonValue(value.target, `authority.grants[${index}].target`))
  };
}

export function createAuthorityGrant(input) {
  assertExactKeys(
    input,
    [
      "id",
      "principal_id",
      "issuer_id",
      "epoch",
      "grants",
      "policy_ids",
      "require_rollback",
      "issued_at",
      "not_before",
      "expires_at"
    ],
    [],
    "authority"
  );
  assertCint(Array.isArray(input.grants) && input.grants.length > 0 && input.grants.length <= 32, "CINT_AUTHORITY_GRANTS", "authority.grants must contain 1-32 exact grants");
  assertCint(typeof input.require_rollback === "boolean", "CINT_AUTHORITY_ROLLBACK", "authority.require_rollback must be boolean");
  const issuedAt = isoInstant(input.issued_at, "authority.issued_at");
  const notBefore = isoInstant(input.not_before, "authority.not_before");
  const expiresAt = isoInstant(input.expires_at, "authority.expires_at");
  assertCint(Date.parse(issuedAt) <= Date.parse(notBefore), "CINT_AUTHORITY_TIME", "authority.not_before precedes issuance");
  assertCint(Date.parse(notBefore) < Date.parse(expiresAt), "CINT_AUTHORITY_TIME", "authority expiry must follow activation");
  const grants = input.grants.map(grantRecord);
  assertCint(new Set(grants.map(canonicalDigest)).size === grants.length, "CINT_AUTHORITY_GRANTS", "authority.grants contains duplicates");
  return sealRecord({
    protocol: "cint/authority/1",
    id: identifier(input.id, "authority.id"),
    principal_id: identifier(input.principal_id, "authority.principal_id"),
    issuer_id: identifier(input.issuer_id, "authority.issuer_id"),
    status: "ACTIVE",
    epoch: integer(input.epoch, "authority.epoch", { minimum: 1 }),
    grants,
    policy_ids: stringArray(input.policy_ids, "authority.policy_ids", {
      minimum: 0,
      maximum: 16,
      bytes: 128
    }).map((value) => identifier(value, "authority.policy_ids item")),
    require_rollback: input.require_rollback,
    issued_at: issuedAt,
    not_before: notBefore,
    expires_at: expiresAt,
    revoked_at: null,
    revocation_reason: null
  });
}

export function revokeAuthority(authority, input) {
  verifySealedRecord(authority, "authority");
  assertExactKeys(input, ["revoked_at", "reason"], [], "authority revocation");
  const revokedAt = isoInstant(input.revoked_at, "authority.revoked_at");
  assertCint(authority.status === "ACTIVE", "CINT_AUTHORITY_INACTIVE", "Only active authority can be revoked");
  assertCint(Date.parse(revokedAt) >= Date.parse(authority.issued_at), "CINT_AUTHORITY_TIME", "authority revocation precedes issuance");
  const unsigned = Object.fromEntries(Object.entries(authority).filter(([key]) => key !== "digest"));
  return sealRecord({
    ...unsigned,
    status: "REVOKED",
    epoch: authority.epoch + 1,
    revoked_at: revokedAt,
    revocation_reason: boundedString(input.reason, "authority revocation reason", { minimum: 1, maximum: 1024 })
  });
}

export function evaluateAuthority({ authority, intent, policy, now }) {
  verifySealedRecord(authority, "authority");
  verifySealedRecord(intent, "intent");
  if (policy) verifySealedRecord(policy, "policy");
  const at = isoInstant(now, "authority evaluation time");
  const reasons = [];
  if (authority.status !== "ACTIVE") reasons.push("CINT_AUTHORITY_INACTIVE");
  if (authority.principal_id !== intent.principal_id) reasons.push("CINT_AUTHORITY_PRINCIPAL_MISMATCH");
  if (Date.parse(at) < Date.parse(authority.not_before)) reasons.push("CINT_AUTHORITY_NOT_YET_VALID");
  if (Date.parse(at) >= Date.parse(authority.expires_at)) reasons.push("CINT_AUTHORITY_EXPIRED");
  const exactGrant = authority.grants.some(
    (grant) =>
      grant.adapter === intent.action.adapter &&
      grant.type === intent.action.type &&
      grant.target_digest === intent.target_digest
  );
  if (!exactGrant) reasons.push("CINT_AUTHORITY_ACTION_DENIED");
  if (policy && authority.policy_ids.length > 0 && !authority.policy_ids.includes(policy.id)) {
    reasons.push("CINT_AUTHORITY_POLICY_DENIED");
  }
  return { allowed: reasons.length === 0, reasons };
}
