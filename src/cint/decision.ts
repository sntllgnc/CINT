import {
  assertCint,
  assertExactKeys,
  canonicalDigest,
  identifier,
  isoInstant,
  sealRecord,
  verifyProtocolRecord
} from "./canonical.js";
import { runCounterIntentChallenge } from "./challenge.js";
import type { BindingDigest, DecisionId } from "./types/brands.js";
import { assertNever, type DecisionStatus } from "./types/states.js";
import type { ChallengeRecord, Decision } from "./types/records.js";

function statusFromChallenge(status: ChallengeRecord["status"]): DecisionStatus {
  switch (status) {
    case "CLEAR": return "ADMIT";
    case "DENIED": return "DENY";
    case "REVIEW": return "REVIEW";
    default: return assertNever(status);
  }
}

export function decide(value: unknown): Decision {
  const input = assertExactKeys(
    value,
    ["id", "intent", "principal", "authority", "policy", "adapter_capability", "machine_state", "now", "expires_at"],
    [],
    "decision request"
  );
  const intent = verifyProtocolRecord(input["intent"], "cint/intent/1", "intent");
  const principal = verifyProtocolRecord(input["principal"], "cint/principal/1", "principal");
  const authority = verifyProtocolRecord(input["authority"], "cint/authority/1", "authority");
  const policy = verifyProtocolRecord(input["policy"], "cint/policy/1", "policy");
  const adapterCapability = verifyProtocolRecord(
    input["adapter_capability"],
    "cint/adapter-capability/1",
    "adapter capability"
  );
  const machineState = verifyProtocolRecord(input["machine_state"], "cint/machine-state/1", "machine state");
  const issuedAt = isoInstant(input["now"], "decision issued_at");
  const expiresAt = isoInstant(input["expires_at"], "decision expires_at");
  assertCint(Date.parse(expiresAt) > Date.parse(issuedAt), "CINT_DECISION_TIME", "Decision expiry must follow issuance");
  assertCint(
    Date.parse(expiresAt) <= Date.parse(authority.expires_at),
    "CINT_DECISION_TIME",
    "Decision cannot outlive authority"
  );
  const challenge = runCounterIntentChallenge({
    intent,
    principal,
    authority,
    policy,
    adapter_capability: adapterCapability,
    machine_state: machineState,
    now: issuedAt
  });
  const status = statusFromChallenge(challenge.status);
  const binding = {
    intent_digest: intent.digest,
    action_digest: intent.action_digest,
    target_digest: intent.target_digest,
    context_digest: intent.context_digest,
    principal_digest: principal.digest,
    authority_id: authority.id,
    authority_digest: authority.digest,
    authority_epoch: authority.epoch,
    policy_id: policy.id,
    policy_digest: policy.digest,
    policy_epoch: policy.epoch,
    adapter_id: adapterCapability.id,
    adapter_capability_digest: adapterCapability.digest,
    machine_state_id: machineState.id,
    machine_state_epoch: machineState.epoch,
    machine_state_digest: machineState.state_digest
  };
  const record = {
    protocol: "cint/decision/1" as const,
    id: identifier<DecisionId>(input["id"], "decision.id"),
    issued_at: issuedAt,
    expires_at: expiresAt,
    binding,
    binding_digest: canonicalDigest<BindingDigest>(binding),
    challenge_digest: challenge.digest,
    reason_codes: challenge.reasons.map((reason) => reason.code),
    execution_authority: "NONE" as const
  };
  switch (status) {
    case "ADMIT": return sealRecord({ ...record, status, receipt_eligible: true as const });
    case "DENY": return sealRecord({ ...record, status, receipt_eligible: false as const });
    case "REVIEW": return sealRecord({ ...record, status, receipt_eligible: false as const });
    default: return assertNever(status);
  }
}
