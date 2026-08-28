import type { AdapterId, CanonicalInstant } from "./brands.js";
import type {
  AdapterCapability,
  AdapterExecution,
  IntentRecord,
  OutcomeVerification,
  RestoredRollback
} from "./records.js";

declare const preparedAction: unique symbol;
declare const verifiedAdapterOutput: unique symbol;

export interface PreparedAction {
  readonly [preparedAction]: "PreparedAction";
}

export interface VerifiedAdapterOutput {
  readonly [verifiedAdapterOutput]: "VerifiedAdapterOutput";
  readonly execution: AdapterExecution;
  readonly verification: OutcomeVerification;
}

export interface AdapterOperationOptions {
  readonly at: CanonicalInstant;
  readonly signal?: AbortSignal;
}

export interface CintAdapter<Prepared extends PreparedAction = PreparedAction> {
  readonly id: AdapterId;
  readonly capability: AdapterCapability;
  prepare(intent: IntentRecord, options: AdapterOperationOptions): Promise<Prepared>;
  execute(prepared: Prepared, options: AdapterOperationOptions): Promise<unknown>;
  verify(prepared: Prepared, execution: AdapterExecution, options: AdapterOperationOptions): Promise<unknown>;
  rollback?(prepared: Prepared, options: AdapterOperationOptions): Promise<unknown>;
}

export type LegacyAgentFloorAdmission = "ADMITTED" | "REJECTED";

export interface LegacyAgentFloorBoundary<Prepared extends PreparedAction = PreparedAction> {
  readonly id: AdapterId;
  readonly capability: AdapterCapability;
  prepare(intent: IntentRecord, options: AdapterOperationOptions): Promise<Prepared>;
  executeCandidate(prepared: Prepared, options: AdapterOperationOptions): Promise<unknown>;
  verifyOutcome(prepared: Prepared, execution: AdapterExecution, options: AdapterOperationOptions): Promise<unknown>;
  restore?(prepared: Prepared, options: AdapterOperationOptions): Promise<RestoredRollback>;
}
