import type {
  ActionDigest,
  AdapterId,
  AuthorityId,
  BindingDigest,
  CanonicalInstant,
  ConsumptionDigest,
  ContextDigest,
  DecisionDigest,
  DecisionId,
  Epoch,
  EvidenceSealDigest,
  ExecutionDigest,
  HmacSha256Signature,
  Identifier,
  IntentDigest,
  IntentId,
  MachineStateDigest,
  MachineStateId,
  OutcomeDigest,
  PolicyId,
  PrincipalId,
  ReceiptDigest,
  ReceiptId,
  RecordDigest,
  RevalidationDigest,
  SealId,
  Sha256Digest,
  TargetDigest,
  VerificationDigest
} from "./brands.js";
import type { InternalCintProtocol, JsonObject, JsonValue } from "./protocols.js";

export interface SealedRecord<
  Protocol extends InternalCintProtocol,
  Digest extends Sha256Digest = RecordDigest
> {
  readonly protocol: Protocol;
  readonly digest: Digest;
}

export type ConsequenceClass = "READ_ONLY" | "CONSEQUENTIAL";

export interface CintAction {
  readonly adapter: AdapterId;
  readonly type: Identifier;
  readonly target: JsonValue;
  readonly parameters: JsonValue;
  readonly consequence: ConsequenceClass;
}

export interface AdapterCapability extends SealedRecord<"cint/adapter-capability/1"> {
  readonly id: AdapterId;
  readonly action_types: readonly Identifier[];
  readonly consequence_classes: readonly ConsequenceClass[];
  readonly prepare_side_effect_free: boolean;
  readonly rollback: boolean;
  readonly interrupt: boolean;
  readonly outcome_verification: boolean;
}

export interface IntentRecord extends SealedRecord<"cint/intent/1", IntentDigest> {
  readonly id: IntentId;
  readonly principal_id: PrincipalId;
  readonly request: string | null;
  readonly action: CintAction;
  readonly declared_effects: readonly string[];
  readonly context: JsonValue;
  readonly uncertainties: readonly string[];
  readonly created_at: CanonicalInstant;
  readonly action_digest: ActionDigest;
  readonly target_digest: TargetDigest;
  readonly context_digest: ContextDigest;
}

export type PrincipalType = "HUMAN" | "SERVICE" | "AGENT";

export interface PrincipalRecord extends SealedRecord<"cint/principal/1"> {
  readonly id: PrincipalId;
  readonly type: PrincipalType;
  readonly authenticated: boolean;
  readonly authority_chain: readonly AuthorityId[];
  readonly attributes: JsonObject;
  readonly resolved_at: CanonicalInstant;
}

export interface AuthorityGrant {
  readonly adapter: AdapterId;
  readonly type: Identifier;
  readonly target_digest: TargetDigest;
}

interface AuthorityBase extends SealedRecord<"cint/authority/1"> {
  readonly id: AuthorityId;
  readonly principal_id: PrincipalId;
  readonly issuer_id: Identifier;
  readonly epoch: Epoch;
  readonly grants: readonly AuthorityGrant[];
  readonly policy_ids: readonly PolicyId[];
  readonly require_rollback: boolean;
  readonly issued_at: CanonicalInstant;
  readonly not_before: CanonicalInstant;
  readonly expires_at: CanonicalInstant;
}

export interface ActiveAuthority extends AuthorityBase {
  readonly status: "ACTIVE";
  readonly revoked_at: null;
  readonly revocation_reason: null;
}

export interface RevokedAuthority extends AuthorityBase {
  readonly status: "REVOKED";
  readonly revoked_at: CanonicalInstant;
  readonly revocation_reason: string;
}

export type AuthorityRecord = ActiveAuthority | RevokedAuthority;

export interface PolicySnapshot extends SealedRecord<"cint/policy/1"> {
  readonly id: PolicyId;
  readonly version: Identifier;
  readonly status: "ACTIVE";
  readonly epoch: Epoch;
  readonly allowed_adapters: readonly AdapterId[];
  readonly allowed_action_types: readonly Identifier[];
  readonly denied_action_types: readonly Identifier[];
  readonly require_explicit_request: boolean;
  readonly require_declared_effects: boolean;
  readonly require_rollback_for_consequential: boolean;
  readonly review_on_uncertainty: boolean;
  readonly issued_at: CanonicalInstant;
}

export interface MachineStateSnapshot extends SealedRecord<"cint/machine-state/1"> {
  readonly id: MachineStateId;
  readonly epoch: Epoch;
  readonly available: boolean;
  readonly observed_at: CanonicalInstant;
  readonly state_digest: MachineStateDigest;
}

export interface ChallengeReason {
  readonly code: Identifier;
  readonly disposition: "DENY" | "REVIEW";
  readonly message: string;
}

export interface ChallengeRecord extends SealedRecord<"cint/challenge/1"> {
  readonly status: "CLEAR" | "DENIED" | "REVIEW";
  readonly checked_at: CanonicalInstant;
  readonly intent_digest: IntentDigest;
  readonly principal_digest: RecordDigest;
  readonly authority_digest: RecordDigest;
  readonly policy_digest: RecordDigest;
  readonly adapter_capability_digest: RecordDigest;
  readonly machine_state_digest: MachineStateDigest;
  readonly reasons: readonly ChallengeReason[];
}

export interface DecisionBinding {
  readonly intent_digest: IntentDigest;
  readonly action_digest: ActionDigest;
  readonly target_digest: TargetDigest;
  readonly context_digest: ContextDigest;
  readonly principal_digest: RecordDigest;
  readonly authority_id: AuthorityId;
  readonly authority_digest: RecordDigest;
  readonly authority_epoch: Epoch;
  readonly policy_id: PolicyId;
  readonly policy_digest: RecordDigest;
  readonly policy_epoch: Epoch;
  readonly adapter_id: AdapterId;
  readonly adapter_capability_digest: RecordDigest;
  readonly machine_state_id: MachineStateId;
  readonly machine_state_epoch: Epoch;
  readonly machine_state_digest: MachineStateDigest;
}

interface DecisionBase extends SealedRecord<"cint/decision/1", DecisionDigest> {
  readonly id: DecisionId;
  readonly issued_at: CanonicalInstant;
  readonly expires_at: CanonicalInstant;
  readonly binding: DecisionBinding;
  readonly binding_digest: BindingDigest;
  readonly challenge_digest: RecordDigest;
  readonly reason_codes: readonly Identifier[];
  readonly execution_authority: "NONE";
}

export interface AdmitDecision extends DecisionBase {
  readonly status: "ADMIT";
  readonly receipt_eligible: true;
}

export interface DenyDecision extends DecisionBase {
  readonly status: "DENY";
  readonly receipt_eligible: false;
}

export interface ReviewDecision extends DecisionBase {
  readonly status: "REVIEW";
  readonly receipt_eligible: false;
}

export type Decision = AdmitDecision | DenyDecision | ReviewDecision;

export interface IssuedDecisionReceipt extends SealedRecord<"cint/decision-receipt/1", ReceiptDigest> {
  readonly id: ReceiptId;
  readonly issuer_id: Identifier;
  readonly decision_id: DecisionId;
  readonly decision_digest: DecisionDigest;
  readonly status: "ISSUED";
  readonly issued_at: CanonicalInstant;
  readonly expires_at: CanonicalInstant;
  readonly nonce: string;
  readonly binding: DecisionBinding;
  readonly binding_digest: BindingDigest;
  readonly signature_algorithm: "HMAC-SHA256";
  readonly signature: HmacSha256Signature;
}

export interface PendingReceiptRecord extends SealedRecord<"cint/receipt-store-entry/1"> {
  readonly state: "PENDING";
  readonly receipt_id: ReceiptId;
  readonly receipt_digest: ReceiptDigest;
  readonly registered_at: CanonicalInstant;
}

export interface ConsumedReceiptRecord extends SealedRecord<"cint/receipt-store-entry/1", ConsumptionDigest> {
  readonly state: "CONSUMED";
  readonly receipt_id: ReceiptId;
  readonly receipt_digest: ReceiptDigest;
  readonly consumed_at: CanonicalInstant;
  readonly revalidation_digest: RevalidationDigest;
}

export interface RejectedReceiptRecord extends SealedRecord<"cint/receipt-store-entry/1"> {
  readonly state: "REJECTED";
  readonly receipt_id: ReceiptId;
  readonly receipt_digest: ReceiptDigest;
  readonly rejected_at: CanonicalInstant;
  readonly revalidation_digest: RevalidationDigest;
  readonly reason_codes: readonly Identifier[];
}

export interface RevalidationCurrent {
  readonly intent_digest: IntentDigest | null;
  readonly action_digest: ActionDigest | null;
  readonly target_digest: TargetDigest | null;
  readonly context_digest: ContextDigest | null;
  readonly principal_digest: RecordDigest | null;
  readonly authority_digest: RecordDigest | null;
  readonly authority_epoch: Epoch | null;
  readonly policy_digest: RecordDigest | null;
  readonly policy_epoch: Epoch | null;
  readonly adapter_capability_digest: RecordDigest | null;
  readonly machine_state_digest: MachineStateDigest | null;
  readonly machine_state_epoch: Epoch | null;
}

interface RevalidationBase extends SealedRecord<"cint/revalidation/1", RevalidationDigest> {
  readonly receipt_id: ReceiptId;
  readonly checked_at: CanonicalInstant;
  readonly binding_digest: BindingDigest;
  readonly current: RevalidationCurrent;
  readonly reason_codes: readonly Identifier[];
}

export interface ValidRevalidation extends RevalidationBase {
  readonly status: "VALID";
}

export interface RevokedRevalidation extends RevalidationBase {
  readonly status: "REVOKED";
}

export interface RejectedRevalidation extends RevalidationBase {
  readonly status: "REJECTED";
}

export interface FailClosedRevalidation extends RevalidationBase {
  readonly status: "FAIL_CLOSED";
}

export type Revalidation =
  | ValidRevalidation
  | RevokedRevalidation
  | RejectedRevalidation
  | FailClosedRevalidation;

export interface AdapterExecution extends SealedRecord<
  "cint/synthetic-execution/1" | "cint/codex-delegation-execution/1" | "cint/execution-interruption/1",
  ExecutionDigest
> {}

interface OutcomeVerificationBase extends SealedRecord<"cint/outcome-verification/1", VerificationDigest> {
  readonly target: string;
  readonly expected_sha256: TargetDigest;
  readonly actual_sha256: TargetDigest;
  readonly checked_at: CanonicalInstant;
}

export interface VerifiedOutcomeVerification extends OutcomeVerificationBase {
  readonly status: "VERIFIED";
}

export interface DivergedOutcomeVerification extends OutcomeVerificationBase {
  readonly status: "DIVERGED";
}

export type OutcomeVerification = VerifiedOutcomeVerification | DivergedOutcomeVerification;

export interface RestoredRollback extends SealedRecord<"cint/rollback/1"> {
  readonly status: "RESTORED";
  readonly target: string;
  readonly expected_sha256: TargetDigest;
  readonly actual_sha256: TargetDigest;
  readonly rolled_back_at: CanonicalInstant;
}

export interface FailedRollback extends SealedRecord<"cint/rollback/1" | "cint/rollback-failure/1"> {
  readonly status: "FAILED";
}

export type RollbackResult = RestoredRollback | FailedRollback;

interface OutcomeBase extends SealedRecord<"cint/outcome/1", OutcomeDigest> {
  readonly receipt_id: ReceiptId;
  readonly receipt_digest: ReceiptDigest;
  readonly action_digest: ActionDigest;
  readonly target_digest: TargetDigest;
  readonly execution_digest: ExecutionDigest;
  readonly verification_digest: VerificationDigest;
  readonly final_state_digest: TargetDigest;
  readonly completed_at: CanonicalInstant;
}

export interface VerifiedOutcome extends OutcomeBase {
  readonly status: "VERIFIED";
  readonly effect_status: "APPLIED";
  readonly rollback_digest: null;
}

export interface RestoredOutcome extends OutcomeBase {
  readonly status: "ROLLED_BACK";
  readonly effect_status: "RESTORED";
  readonly rollback_digest: RecordDigest;
}

export type Outcome = VerifiedOutcome | RestoredOutcome;

export interface EvidenceSeal extends SealedRecord<"cint/evidence-seal/1", EvidenceSealDigest> {
  readonly id: SealId;
  readonly issuer_id: Identifier;
  readonly status: "SEALED";
  readonly outcome_status: Outcome["status"];
  readonly receipt_id: ReceiptId;
  readonly receipt_digest: ReceiptDigest;
  readonly consumption_digest: ConsumptionDigest;
  readonly revalidation_digest: RevalidationDigest;
  readonly outcome_digest: OutcomeDigest;
  readonly ledger_head_digest: RecordDigest;
  readonly issued_at: CanonicalInstant;
  readonly signature_algorithm: "HMAC-SHA256";
  readonly signature: HmacSha256Signature;
}

interface ExecutionResultBase extends SealedRecord<"cint/execution-result/1"> {
  readonly receipt_id: string | null;
  readonly receipt_digest: ReceiptDigest | null;
  readonly consumption_digest: ConsumptionDigest | null;
  readonly revalidation_digest: RevalidationDigest | null;
  readonly action_started: boolean;
  readonly completed_at: CanonicalInstant;
}

export interface SealedExecutionResult extends ExecutionResultBase {
  readonly status: "SEALED";
  readonly outcome: VerifiedOutcome;
  readonly evidence_seal: EvidenceSeal;
  readonly error_code: null;
}

export interface RolledBackExecutionResult extends ExecutionResultBase {
  readonly status: "ROLLED_BACK";
  readonly outcome: RestoredOutcome;
  readonly evidence_seal: EvidenceSeal;
  readonly error_code: string | null;
}

export interface FailedExecutionResult extends ExecutionResultBase {
  readonly status: "REPLAY_REJECTED" | "REJECTED" | "REVOKED" | "FAIL_CLOSED";
  readonly outcome: null;
  readonly evidence_seal: null;
  readonly error_code: string;
}

export type ExecutionResult = SealedExecutionResult | RolledBackExecutionResult | FailedExecutionResult;
