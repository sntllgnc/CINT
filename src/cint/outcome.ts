import {
  assertCint,
  assertExactKeys,
  boundedString,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifyProtocolRecord,
  verifySealedRecord
} from "./canonical.js";
import type {
  ExecutionDigest,
  RecordDigest,
  TargetDigest,
  VerificationDigest
} from "./types/brands.js";
import type {
  IssuedDecisionReceipt,
  OutcomeVerification,
  RestoredOutcome,
  RestoredRollback,
  VerifiedOutcome
} from "./types/records.js";

export interface AppliedOutcomeInput {
  readonly receipt: IssuedDecisionReceipt;
  readonly execution: unknown;
  readonly verification: OutcomeVerification & { readonly status: "VERIFIED" };
  readonly rollback: null;
  readonly completed_at: unknown;
}

export interface RestoredOutcomeInput {
  readonly receipt: IssuedDecisionReceipt;
  readonly execution: unknown;
  readonly verification: OutcomeVerification;
  readonly rollback: RestoredRollback;
  readonly completed_at: unknown;
}

interface VerifiedExecutionEvidence {
  readonly digest: ExecutionDigest;
}

export function verifyOutcomeVerification(value: unknown): OutcomeVerification {
  const record = verifySealedRecord(value, "outcome verification");
  assertCint(
    record["protocol"] === "cint/outcome-verification/1",
    "CINT_PROTOCOL_INVALID",
    "Outcome verification uses an unsupported protocol"
  );
  const status = record["status"];
  assertCint(
    status === "VERIFIED" || status === "DIVERGED",
    "CINT_OUTCOME_UNVERIFIED",
    "Outcome verification status is invalid"
  );
  return {
    protocol: "cint/outcome-verification/1",
    status,
    target: boundedString(record["target"], "outcome verification target"),
    expected_sha256: sha256Digest<TargetDigest>(record["expected_sha256"], "outcome verification expected_sha256"),
    actual_sha256: sha256Digest<TargetDigest>(record["actual_sha256"], "outcome verification actual_sha256"),
    checked_at: isoInstant(record["checked_at"], "outcome verification checked_at"),
    digest: sha256Digest<VerificationDigest>(record["digest"], "outcome verification digest")
  };
}

export function verifyRestoredRollback(value: unknown): RestoredRollback {
  const record = verifySealedRecord(value, "rollback");
  assertCint(
    record["protocol"] === "cint/rollback/1" && record["status"] === "RESTORED",
    "CINT_ROLLBACK_FAILED",
    "Rollback did not produce restored evidence"
  );
  return {
    protocol: "cint/rollback/1",
    status: "RESTORED",
    target: boundedString(record["target"], "rollback target"),
    expected_sha256: sha256Digest<TargetDigest>(record["expected_sha256"], "rollback expected_sha256"),
    actual_sha256: sha256Digest<TargetDigest>(record["actual_sha256"], "rollback actual_sha256"),
    rolled_back_at: isoInstant(record["rolled_back_at"], "rollback rolled_back_at"),
    digest: sha256Digest<RecordDigest>(record["digest"], "rollback digest")
  };
}

function verifiedExecution(value: unknown): VerifiedExecutionEvidence {
  const record = verifySealedRecord(value, "execution");
  const protocol = record["protocol"];
  assertCint(
    protocol === "cint/synthetic-execution/1" ||
      protocol === "cint/codex-delegation-execution/1" ||
      protocol === "cint/execution-interruption/1",
    "CINT_PROTOCOL_INVALID",
    "Adapter execution uses an unsupported protocol"
  );
  return { digest: sha256Digest<ExecutionDigest>(record["digest"], "execution digest") };
}

export function createOutcome(input: AppliedOutcomeInput): VerifiedOutcome;
export function createOutcome(input: RestoredOutcomeInput): RestoredOutcome;
export function createOutcome(value: unknown): VerifiedOutcome | RestoredOutcome {
  const input = assertExactKeys(
    value,
    ["receipt", "execution", "verification", "rollback", "completed_at"],
    [],
    "outcome"
  );
  const receipt = verifyProtocolRecord(input["receipt"], "cint/decision-receipt/1", "receipt");
  const execution = verifiedExecution(input["execution"]);
  const verification = verifyOutcomeVerification(input["verification"]);
  const rollback = input["rollback"] === null ? null : verifyRestoredRollback(input["rollback"]);
  const completedAt = isoInstant(input["completed_at"], "outcome completed_at");

  if (verification.status === "VERIFIED" && rollback === null) {
    return sealRecord({
      protocol: "cint/outcome/1" as const,
      status: "VERIFIED" as const,
      effect_status: "APPLIED" as const,
      receipt_id: receipt.id,
      receipt_digest: receipt.digest,
      action_digest: receipt.binding.action_digest,
      target_digest: receipt.binding.target_digest,
      execution_digest: execution.digest,
      verification_digest: verification.digest,
      rollback_digest: null,
      final_state_digest: verification.actual_sha256,
      completed_at: completedAt
    });
  }

  assertCint(rollback !== null, "CINT_OUTCOME_UNVERIFIED", "Outcome must be verified or demonstrably restored");
  return sealRecord({
    protocol: "cint/outcome/1" as const,
    status: "ROLLED_BACK" as const,
    effect_status: "RESTORED" as const,
    receipt_id: receipt.id,
    receipt_digest: receipt.digest,
    action_digest: receipt.binding.action_digest,
    target_digest: receipt.binding.target_digest,
    execution_digest: execution.digest,
    verification_digest: verification.digest,
    rollback_digest: rollback.digest,
    final_state_digest: rollback.actual_sha256,
    completed_at: completedAt
  });
}
