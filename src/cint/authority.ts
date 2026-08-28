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
  verifyProtocolRecord
} from "./canonical.js";
import type {
  AdapterId,
  AuthorityId,
  Epoch,
  Identifier,
  PolicyId,
  PrincipalId,
  TargetDigest
} from "./types/brands.js";
import type {
  ActiveAuthority,
  AuthorityGrant,
  AuthorityRecord,
  IntentRecord,
  PolicySnapshot,
  RevokedAuthority
} from "./types/records.js";

export interface AuthorityEvaluationInput {
  readonly authority: AuthorityRecord;
  readonly intent: IntentRecord;
  readonly policy?: PolicySnapshot | null;
  readonly now: unknown;
}

export interface AuthorityEvaluationResult {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
}

function grantRecord(value: unknown, index: number): AuthorityGrant {
  const input = assertExactKeys(value, ["adapter", "type", "target"], [], `authority.grants[${index}]`);
  return {
    adapter: identifier<AdapterId>(input["adapter"], `authority.grants[${index}].adapter`),
    type: identifier<Identifier>(input["type"], `authority.grants[${index}].type`),
    target_digest: canonicalDigest<TargetDigest>(assertJsonValue(input["target"], `authority.grants[${index}].target`))
  };
}

export function createAuthorityGrant(value: unknown): ActiveAuthority {
  const input = assertExactKeys(
    value,
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
  assertCint(
    Array.isArray(input["grants"]) && input["grants"].length > 0 && input["grants"].length <= 32,
    "CINT_AUTHORITY_GRANTS",
    "authority.grants must contain 1-32 exact grants"
  );
  assertCint(typeof input["require_rollback"] === "boolean", "CINT_AUTHORITY_ROLLBACK", "authority.require_rollback must be boolean");
  const issuedAt = isoInstant(input["issued_at"], "authority.issued_at");
  const notBefore = isoInstant(input["not_before"], "authority.not_before");
  const expiresAt = isoInstant(input["expires_at"], "authority.expires_at");
  assertCint(Date.parse(issuedAt) <= Date.parse(notBefore), "CINT_AUTHORITY_TIME", "authority.not_before precedes issuance");
  assertCint(Date.parse(notBefore) < Date.parse(expiresAt), "CINT_AUTHORITY_TIME", "authority expiry must follow activation");
  const grants = input["grants"].map((grant, index) => grantRecord(grant, index));
  assertCint(new Set(grants.map(canonicalDigest)).size === grants.length, "CINT_AUTHORITY_GRANTS", "authority.grants contains duplicates");
  return sealRecord({
    protocol: "cint/authority/1" as const,
    id: identifier<AuthorityId>(input["id"], "authority.id"),
    principal_id: identifier<PrincipalId>(input["principal_id"], "authority.principal_id"),
    issuer_id: identifier<Identifier>(input["issuer_id"], "authority.issuer_id"),
    status: "ACTIVE" as const,
    epoch: integer<Epoch>(input["epoch"], "authority.epoch", { minimum: 1 }),
    grants,
    policy_ids: stringArray(input["policy_ids"], "authority.policy_ids", {
      minimum: 0,
      maximum: 16,
      bytes: 128
    }).map((item) => identifier<PolicyId>(item, "authority.policy_ids item")),
    require_rollback: input["require_rollback"],
    issued_at: issuedAt,
    not_before: notBefore,
    expires_at: expiresAt,
    revoked_at: null,
    revocation_reason: null
  });
}

export function revokeAuthority(authority: unknown, value: unknown): RevokedAuthority {
  const current = verifyProtocolRecord(authority, "cint/authority/1", "authority");
  const input = assertExactKeys(value, ["revoked_at", "reason"], [], "authority revocation");
  const revokedAt = isoInstant(input["revoked_at"], "authority.revoked_at");
  assertCint(current.status === "ACTIVE", "CINT_AUTHORITY_INACTIVE", "Only active authority can be revoked");
  assertCint(Date.parse(revokedAt) >= Date.parse(current.issued_at), "CINT_AUTHORITY_TIME", "authority revocation precedes issuance");
  return sealRecord({
    protocol: current.protocol,
    id: current.id,
    principal_id: current.principal_id,
    issuer_id: current.issuer_id,
    status: "REVOKED" as const,
    epoch: integer<Epoch>(current.epoch + 1, "authority.epoch", { minimum: 1 }),
    grants: current.grants,
    policy_ids: current.policy_ids,
    require_rollback: current.require_rollback,
    issued_at: current.issued_at,
    not_before: current.not_before,
    expires_at: current.expires_at,
    revoked_at: revokedAt,
    revocation_reason: boundedString(input["reason"], "authority revocation reason", { minimum: 1, maximum: 1024 })
  });
}

export function evaluateAuthority(input: AuthorityEvaluationInput): AuthorityEvaluationResult {
  const authority = verifyProtocolRecord(input.authority, "cint/authority/1", "authority");
  const intent = verifyProtocolRecord(input.intent, "cint/intent/1", "intent");
  const policy = input.policy ? verifyProtocolRecord(input.policy, "cint/policy/1", "policy") : null;
  const at = isoInstant(input.now, "authority evaluation time");
  const reasons: string[] = [];
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
