import {
  assertCint,
  assertExactKeys,
  isoInstant,
  sealRecord,
  verifyProtocolRecord,
  verifySealedRecord
} from "./canonical.js";

export function createOutcome(input) {
  assertExactKeys(
    input,
    ["receipt", "execution", "verification", "rollback", "completed_at"],
    [],
    "outcome"
  );
  verifyProtocolRecord(input.receipt, "cint/decision-receipt/1", "receipt");
  verifySealedRecord(input.execution, "execution");
  verifySealedRecord(input.verification, "outcome verification");
  if (input.rollback !== null) verifySealedRecord(input.rollback, "rollback");
  const applied = input.verification.status === "VERIFIED" && input.rollback === null;
  const restored = ["VERIFIED", "DIVERGED"].includes(input.verification.status) && input.rollback?.status === "RESTORED";
  assertCint(applied || restored, "CINT_OUTCOME_UNVERIFIED", "Outcome must be verified or demonstrably restored");
  return sealRecord({
    protocol: "cint/outcome/1",
    status: applied ? "VERIFIED" : "ROLLED_BACK",
    effect_status: applied ? "APPLIED" : "RESTORED",
    receipt_id: input.receipt.id,
    receipt_digest: input.receipt.digest,
    action_digest: input.receipt.binding.action_digest,
    target_digest: input.receipt.binding.target_digest,
    execution_digest: input.execution.digest,
    verification_digest: input.verification.digest,
    rollback_digest: input.rollback?.digest ?? null,
    final_state_digest: applied ? input.verification.actual_sha256 : input.rollback.actual_sha256,
    completed_at: isoInstant(input.completed_at, "outcome completed_at")
  });
}
