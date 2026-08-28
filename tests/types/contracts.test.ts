import type {
  ActionDigest,
  AuthorityId,
  OutcomeDigest,
  PolicyId
} from "../../src/cint/types/brands.js";
import type {
  LegacyAgentFloorAdmission,
  VerifiedAdapterOutput
} from "../../src/cint/types/adapters.js";
import type {
  AdmitDecision,
  AdapterExecution,
  AuthorityRecord,
  ConsumedReceiptRecord,
  Decision,
  DenyDecision,
  IssuedDecisionReceipt,
  ReviewDecision,
  VerifiedOutcome
} from "../../src/cint/types/records.js";
import type { DecisionReceiptAuthority } from "../../src/cint/receipt.js";

declare const decision: Decision;
declare const admitDecision: AdmitDecision;
declare const denyDecision: DenyDecision;
declare const reviewDecision: ReviewDecision;
declare const issuedReceipt: IssuedDecisionReceipt;
declare const consumedReceipt: ConsumedReceiptRecord;
declare const actionDigest: ActionDigest;
declare const outcomeDigest: OutcomeDigest;
declare const policyId: PolicyId;
declare const authorityId: AuthorityId;
declare const adapterExecution: AdapterExecution;
declare const verifiedAdapterOutput: VerifiedAdapterOutput;
declare const verifiedOutcome: VerifiedOutcome;
declare const legacyAdmission: LegacyAgentFloorAdmission;
declare const unknownProtocolRecord: unknown;
declare const authority: AuthorityRecord;
declare const receiptAuthority: DecisionReceiptAuthority;

function requireReceipt(value: IssuedDecisionReceipt): void { void value; }
function issueReceipt(value: AdmitDecision): void { void value; }
function requireConsumed(value: ConsumedReceiptRecord): void { void value; }
function requireActionDigest(value: ActionDigest): void { void value; }
function requireAuthorityId(value: AuthorityId): void { void value; }
function requireVerifiedOutput(value: VerifiedAdapterOutput): void { void value; }
function requireVerifiedOutcome(value: VerifiedOutcome): void { void value; }
function requireAuthority(value: AuthorityRecord): void { void value; }

requireReceipt(issuedReceipt);
issueReceipt(admitDecision);
requireConsumed(consumedReceipt);
requireActionDigest(actionDigest);
requireAuthorityId(authorityId);
requireVerifiedOutput(verifiedAdapterOutput);
requireVerifiedOutcome(verifiedOutcome);
requireAuthority(authority);
receiptAuthority.issue({ decision: admitDecision, issued_at: "2026-08-27T00:00:00.000Z" });

// @ts-expect-error a decision is not an issued receipt
requireReceipt(decision);
// @ts-expect-error the concrete receipt authority rejects DENY at compile time
receiptAuthority.issue({ decision: denyDecision, issued_at: "2026-08-27T00:00:00.000Z" });
// @ts-expect-error the concrete receipt authority rejects REVIEW at compile time
receiptAuthority.issue({ decision: reviewDecision, issued_at: "2026-08-27T00:00:00.000Z" });
// @ts-expect-error DENY cannot enter receipt issuance
issueReceipt(denyDecision);
// @ts-expect-error REVIEW cannot enter receipt issuance
issueReceipt(reviewDecision);
// @ts-expect-error an issued receipt is not consumed evidence
requireConsumed(issuedReceipt);
// @ts-expect-error an outcome digest cannot bind an action
requireActionDigest(outcomeDigest);
// @ts-expect-error a policy identifier is not an authority identifier
requireAuthorityId(policyId);
// @ts-expect-error unverified adapter execution is not verified output
requireVerifiedOutput(adapterExecution);
// @ts-expect-error unverified adapter execution is not a verified outcome
requireVerifiedOutcome(adapterExecution);
// @ts-expect-error legacy ADMITTED telemetry has no CINT authority
requireAuthority(legacyAdmission);
// @ts-expect-error an unknown protocol record must be validated first
requireAuthority(unknownProtocolRecord);
