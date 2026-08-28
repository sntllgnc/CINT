import {
  isPlainRecord,
  isoInstant,
  sealRecord,
  verifyProtocolRecord
} from "./canonical.js";
import { runCounterIntentChallenge } from "./challenge.js";
import type { CanonicalInstant } from "./types/brands.js";
import type {
  IssuedDecisionReceipt,
  Revalidation
} from "./types/records.js";

export interface ReceiptVerifier {
  verify(receipt: unknown, options?: { readonly now?: unknown }): IssuedDecisionReceipt;
}

export interface RevalidationInput {
  readonly receipt: unknown;
  readonly receipt_authority: ReceiptVerifier;
  readonly intent: unknown;
  readonly principal: unknown;
  readonly authority: unknown;
  readonly policy: unknown;
  readonly adapter_capability: unknown;
  readonly machine_state: unknown;
  readonly now: unknown;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function containsOnlyReceiptExpiry(values: readonly string[]): boolean {
  return values.every((code) => code === "CINT_RECEIPT_EXPIRED");
}

function field(record: unknown, name: string): unknown {
  return isPlainRecord(record) ? record[name] : undefined;
}

function errorCode(error: unknown, fallback: string): string {
  const code = error !== null && (typeof error === "object" || typeof error === "function")
    ? Reflect.get(error, "code")
    : undefined;
  return typeof code === "string" ? code : fallback;
}

function collectProtocolFailure(
  record: unknown,
  protocol:
    | "cint/intent/1"
    | "cint/principal/1"
    | "cint/authority/1"
    | "cint/policy/1"
    | "cint/adapter-capability/1"
    | "cint/machine-state/1",
  label: string,
  reasonCodes: string[]
): void {
  try {
    verifyProtocolRecord(record, protocol, label);
  } catch (error) {
    reasonCodes.push(errorCode(error, "CINT_RECORD_INVALID"));
  }
}

function challengeAt(input: RevalidationInput, checkedAt: CanonicalInstant): ReturnType<typeof runCounterIntentChallenge> {
  return runCounterIntentChallenge({
    intent: verifyProtocolRecord(input.intent, "cint/intent/1", "intent"),
    principal: verifyProtocolRecord(input.principal, "cint/principal/1", "principal"),
    authority: verifyProtocolRecord(input.authority, "cint/authority/1", "authority"),
    policy: verifyProtocolRecord(input.policy, "cint/policy/1", "policy"),
    adapter_capability: verifyProtocolRecord(input.adapter_capability, "cint/adapter-capability/1", "adapter_capability"),
    machine_state: verifyProtocolRecord(input.machine_state, "cint/machine-state/1", "machine_state"),
    now: checkedAt
  });
}

export function revalidateReceipt(input: RevalidationInput): Revalidation {
  const checkedAt = isoInstant(input.now, "revalidation time");
  const reasonCodes: string[] = [];
  let receiptAuthenticated = false;
  try {
    input.receipt_authority.verify(input.receipt);
    receiptAuthenticated = true;
  } catch (error) {
    reasonCodes.push(errorCode(error, "CINT_RECEIPT_INVALID"));
  }
  if (receiptAuthenticated) {
    try {
      input.receipt_authority.verify(input.receipt, { now: checkedAt });
    } catch (error) {
      reasonCodes.push(errorCode(error, "CINT_RECEIPT_INVALID"));
    }
  }

  collectProtocolFailure(input.intent, "cint/intent/1", "intent", reasonCodes);
  collectProtocolFailure(input.principal, "cint/principal/1", "principal", reasonCodes);
  collectProtocolFailure(input.authority, "cint/authority/1", "authority", reasonCodes);
  collectProtocolFailure(input.policy, "cint/policy/1", "policy", reasonCodes);
  collectProtocolFailure(input.adapter_capability, "cint/adapter-capability/1", "adapter_capability", reasonCodes);
  collectProtocolFailure(input.machine_state, "cint/machine-state/1", "machine_state", reasonCodes);

  const rawBinding = field(input.receipt, "binding");
  const binding = isPlainRecord(rawBinding) ? rawBinding : {};
  if (field(input.intent, "action_digest") !== binding["action_digest"]) reasonCodes.push("CINT_ACTION_DIGEST_CHANGED");
  if (field(input.intent, "target_digest") !== binding["target_digest"]) reasonCodes.push("CINT_TARGET_CHANGED");
  if (field(input.intent, "context_digest") !== binding["context_digest"]) reasonCodes.push("CINT_CONTEXT_CHANGED");
  if (field(input.intent, "digest") !== binding["intent_digest"]) reasonCodes.push("CINT_INTENT_CHANGED");
  if (field(input.principal, "digest") !== binding["principal_digest"]) reasonCodes.push("CINT_PRINCIPAL_CHANGED");
  if (
    field(input.authority, "id") !== binding["authority_id"] ||
    field(input.authority, "digest") !== binding["authority_digest"] ||
    field(input.authority, "epoch") !== binding["authority_epoch"] ||
    field(input.authority, "status") !== "ACTIVE"
  ) {
    reasonCodes.push("CINT_AUTHORITY_CHANGED");
  }
  if (
    field(input.policy, "id") !== binding["policy_id"] ||
    field(input.policy, "digest") !== binding["policy_digest"] ||
    field(input.policy, "epoch") !== binding["policy_epoch"] ||
    field(input.policy, "status") !== "ACTIVE"
  ) {
    reasonCodes.push("CINT_POLICY_CHANGED");
  }
  if (
    field(input.adapter_capability, "id") !== binding["adapter_id"] ||
    field(input.adapter_capability, "digest") !== binding["adapter_capability_digest"]
  ) {
    reasonCodes.push("CINT_ADAPTER_CHANGED");
  }
  if (
    field(input.machine_state, "id") !== binding["machine_state_id"] ||
    field(input.machine_state, "epoch") !== binding["machine_state_epoch"] ||
    field(input.machine_state, "state_digest") !== binding["machine_state_digest"]
  ) {
    reasonCodes.push("CINT_MACHINE_STATE_CHANGED");
  }
  if (field(input.machine_state, "available") !== true) reasonCodes.push("CINT_UNAVAILABLE");

  if (receiptAuthenticated && containsOnlyReceiptExpiry(reasonCodes)) {
    try {
      const challenge = challengeAt(input, checkedAt);
      if (challenge.status !== "CLEAR") {
        reasonCodes.push(...challenge.reasons.map((reason) => reason.code));
      }
    } catch (error) {
      reasonCodes.push(errorCode(error, "CINT_REVALIDATION_FAILED"));
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
  const sealed = sealRecord({
    protocol: "cint/revalidation/1" as const,
    receipt_id: field(input.receipt, "id") ?? "receipt.invalid",
    status,
    checked_at: checkedAt,
    binding_digest: field(input.receipt, "binding_digest") ?? "0".repeat(64),
    current: {
      intent_digest: field(input.intent, "digest") ?? null,
      action_digest: field(input.intent, "action_digest") ?? null,
      target_digest: field(input.intent, "target_digest") ?? null,
      context_digest: field(input.intent, "context_digest") ?? null,
      principal_digest: field(input.principal, "digest") ?? null,
      authority_digest: field(input.authority, "digest") ?? null,
      authority_epoch: field(input.authority, "epoch") ?? null,
      policy_digest: field(input.policy, "digest") ?? null,
      policy_epoch: field(input.policy, "epoch") ?? null,
      adapter_capability_digest: field(input.adapter_capability, "digest") ?? null,
      machine_state_digest: field(input.machine_state, "state_digest") ?? null,
      machine_state_epoch: field(input.machine_state, "epoch") ?? null
    },
    reason_codes: reasons
  });
  return verifyProtocolRecord(sealed, "cint/revalidation/1", "revalidation");
}
