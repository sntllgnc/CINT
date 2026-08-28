import { isoInstant, sealRecord, verifyProtocolRecord } from "./canonical.js";
import { runCounterIntentChallenge } from "./challenge.js";

function unique(values) {
  return [...new Set(values)];
}

export function revalidateReceipt(input) {
  const checkedAt = isoInstant(input.now, "revalidation time");
  const reasonCodes = [];
  let receiptAuthenticated = false;
  try {
    input.receipt_authority.verify(input.receipt);
    receiptAuthenticated = true;
  } catch (error) {
    reasonCodes.push(error.code ?? "CINT_RECEIPT_INVALID");
  }
  if (receiptAuthenticated) {
    try {
      input.receipt_authority.verify(input.receipt, { now: checkedAt });
    } catch (error) {
      reasonCodes.push(error.code ?? "CINT_RECEIPT_INVALID");
    }
  }

  for (const [label, record, protocol] of [
    ["intent", input.intent, "cint/intent/1"],
    ["principal", input.principal, "cint/principal/1"],
    ["authority", input.authority, "cint/authority/1"],
    ["policy", input.policy, "cint/policy/1"],
    ["adapter_capability", input.adapter_capability, "cint/adapter-capability/1"],
    ["machine_state", input.machine_state, "cint/machine-state/1"]
  ]) {
    try {
      verifyProtocolRecord(record, protocol, label);
    } catch (error) {
      reasonCodes.push(error.code ?? "CINT_RECORD_INVALID");
    }
  }

  const binding = input.receipt?.binding ?? {};
  if (input.intent?.action_digest !== binding.action_digest) reasonCodes.push("CINT_ACTION_DIGEST_CHANGED");
  if (input.intent?.target_digest !== binding.target_digest) reasonCodes.push("CINT_TARGET_CHANGED");
  if (input.intent?.context_digest !== binding.context_digest) reasonCodes.push("CINT_CONTEXT_CHANGED");
  if (input.intent?.digest !== binding.intent_digest) reasonCodes.push("CINT_INTENT_CHANGED");
  if (input.principal?.digest !== binding.principal_digest) reasonCodes.push("CINT_PRINCIPAL_CHANGED");
  if (
    input.authority?.id !== binding.authority_id ||
    input.authority?.digest !== binding.authority_digest ||
    input.authority?.epoch !== binding.authority_epoch ||
    input.authority?.status !== "ACTIVE"
  ) {
    reasonCodes.push("CINT_AUTHORITY_CHANGED");
  }
  if (
    input.policy?.id !== binding.policy_id ||
    input.policy?.digest !== binding.policy_digest ||
    input.policy?.epoch !== binding.policy_epoch ||
    input.policy?.status !== "ACTIVE"
  ) {
    reasonCodes.push("CINT_POLICY_CHANGED");
  }
  if (
    input.adapter_capability?.id !== binding.adapter_id ||
    input.adapter_capability?.digest !== binding.adapter_capability_digest
  ) {
    reasonCodes.push("CINT_ADAPTER_CHANGED");
  }
  if (
    input.machine_state?.id !== binding.machine_state_id ||
    input.machine_state?.epoch !== binding.machine_state_epoch ||
    input.machine_state?.state_digest !== binding.machine_state_digest
  ) {
    reasonCodes.push("CINT_MACHINE_STATE_CHANGED");
  }
  if (input.machine_state?.available !== true) reasonCodes.push("CINT_UNAVAILABLE");

  if (receiptAuthenticated && reasonCodes.every((code) => code === "CINT_RECEIPT_EXPIRED")) {
    try {
      const challenge = runCounterIntentChallenge({
        intent: input.intent,
        principal: input.principal,
        authority: input.authority,
        policy: input.policy,
        adapter_capability: input.adapter_capability,
        machine_state: input.machine_state,
        now: checkedAt
      });
      if (challenge.status !== "CLEAR") {
        reasonCodes.push(...challenge.reasons.map((reason) => reason.code));
      }
    } catch (error) {
      reasonCodes.push(error.code ?? "CINT_REVALIDATION_FAILED");
    }
  }

  const reasons = unique(reasonCodes);
  const rejected = reasons.some((code) =>
    [
      "CINT_RECEIPT_SIGNATURE_INVALID",
      "CINT_RECEIPT_ISSUER_MISMATCH",
      "CINT_RECEIPT_BINDING_INVALID",
      "CINT_ACTION_DIGEST_CHANGED",
      "CINT_TARGET_CHANGED",
      "CINT_CONTEXT_CHANGED",
      "CINT_INTENT_CHANGED",
      "CINT_PROTOCOL_INVALID",
      "CINT_SCHEMA_INVALID",
      "CINT_RECORD_TAMPERED"
    ].includes(code)
  );
  const unavailable = reasons.includes("CINT_UNAVAILABLE");
  const status = reasons.length === 0 ? "VALID" : unavailable ? "FAIL_CLOSED" : rejected ? "REJECTED" : "REVOKED";
  return sealRecord({
    protocol: "cint/revalidation/1",
    receipt_id: input.receipt?.id ?? "receipt.invalid",
    status,
    checked_at: checkedAt,
    binding_digest: input.receipt?.binding_digest ?? "0".repeat(64),
    current: {
      intent_digest: input.intent?.digest ?? null,
      action_digest: input.intent?.action_digest ?? null,
      target_digest: input.intent?.target_digest ?? null,
      context_digest: input.intent?.context_digest ?? null,
      principal_digest: input.principal?.digest ?? null,
      authority_digest: input.authority?.digest ?? null,
      authority_epoch: input.authority?.epoch ?? null,
      policy_digest: input.policy?.digest ?? null,
      policy_epoch: input.policy?.epoch ?? null,
      adapter_capability_digest: input.adapter_capability?.digest ?? null,
      machine_state_digest: input.machine_state?.state_digest ?? null,
      machine_state_epoch: input.machine_state?.epoch ?? null
    },
    reason_codes: reasons
  });
}
