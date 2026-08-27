import {
  assertCint,
  assertExactKeys,
  canonicalDigest,
  identifier,
  isoInstant,
  sealRecord
} from "./canonical.js";
import { runCounterIntentChallenge } from "./challenge.js";

export function decide(input) {
  assertExactKeys(
    input,
    ["id", "intent", "principal", "authority", "policy", "adapter_capability", "machine_state", "now", "expires_at"],
    [],
    "decision request"
  );
  const issuedAt = isoInstant(input.now, "decision issued_at");
  const expiresAt = isoInstant(input.expires_at, "decision expires_at");
  assertCint(Date.parse(expiresAt) > Date.parse(issuedAt), "CINT_DECISION_TIME", "Decision expiry must follow issuance");
  assertCint(
    Date.parse(expiresAt) <= Date.parse(input.authority.expires_at),
    "CINT_DECISION_TIME",
    "Decision cannot outlive authority"
  );
  const challenge = runCounterIntentChallenge({
    intent: input.intent,
    principal: input.principal,
    authority: input.authority,
    policy: input.policy,
    adapter_capability: input.adapter_capability,
    machine_state: input.machine_state,
    now: issuedAt
  });
  const status = challenge.status === "CLEAR" ? "ADMIT" : challenge.status === "REVIEW" ? "REVIEW" : "DENY";
  const binding = {
    intent_digest: input.intent.digest,
    action_digest: input.intent.action_digest,
    target_digest: input.intent.target_digest,
    context_digest: input.intent.context_digest,
    principal_digest: input.principal.digest,
    authority_id: input.authority.id,
    authority_digest: input.authority.digest,
    authority_epoch: input.authority.epoch,
    policy_id: input.policy.id,
    policy_digest: input.policy.digest,
    policy_epoch: input.policy.epoch,
    adapter_id: input.adapter_capability.id,
    adapter_capability_digest: input.adapter_capability.digest,
    machine_state_id: input.machine_state.id,
    machine_state_epoch: input.machine_state.epoch,
    machine_state_digest: input.machine_state.state_digest
  };
  return sealRecord({
    protocol: "cint/decision/1",
    id: identifier(input.id, "decision.id"),
    status,
    issued_at: issuedAt,
    expires_at: expiresAt,
    binding,
    binding_digest: canonicalDigest(binding),
    challenge_digest: challenge.digest,
    reason_codes: challenge.reasons.map((reason) => reason.code),
    receipt_eligible: status === "ADMIT",
    execution_authority: "NONE"
  });
}
