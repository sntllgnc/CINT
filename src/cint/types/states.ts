export type DecisionStatus = "ADMIT" | "DENY" | "REVIEW";
export type RevalidationStatus = "VALID" | "REVOKED" | "REJECTED" | "FAIL_CLOSED";
export type ExecutionResultStatus = "SEALED" | "ROLLED_BACK" | "REPLAY_REJECTED" | "REJECTED" | "REVOKED" | "FAIL_CLOSED";
export type OutcomeStatus = "VERIFIED" | "ROLLED_BACK";
export type ReceiptStoreState = "ABSENT" | "PENDING" | "LOCKED" | "CONSUMED" | "REJECTED";
export type AuthorityState = "ACTIVE" | "REVOKED";
export type CintLifecycleState =
  | "REQUESTED"
  | "CHALLENGED"
  | "DENIED"
  | "REVIEW"
  | "ADMITTED"
  | "RECEIPT_ISSUED"
  | "REVALIDATED"
  | "REVOKED"
  | "RECEIPT_CONSUMED"
  | "EXECUTING"
  | "INTERRUPTED"
  | "VERIFIED"
  | "ROLLED_BACK"
  | "SEALED"
  | "FAIL_CLOSED"
  | "REPLAY_REJECTED";

export function assertNever(value: never): never {
  throw new Error(`Unhandled CINT state: ${String(value)}`);
}

export function decisionDisposition(status: DecisionStatus): "issue" | "terminal" {
  switch (status) {
    case "ADMIT": return "issue";
    case "DENY": return "terminal";
    case "REVIEW": return "terminal";
    default: return assertNever(status);
  }
}

export function revalidationDisposition(status: RevalidationStatus): "continue" | "terminal" {
  switch (status) {
    case "VALID": return "continue";
    case "REVOKED": return "terminal";
    case "REJECTED": return "terminal";
    case "FAIL_CLOSED": return "terminal";
    default: return assertNever(status);
  }
}

export function executionDisposition(status: ExecutionResultStatus): "sealed" | "terminal" {
  switch (status) {
    case "SEALED": return "sealed";
    case "ROLLED_BACK": return "sealed";
    case "REPLAY_REJECTED": return "terminal";
    case "REJECTED": return "terminal";
    case "REVOKED": return "terminal";
    case "FAIL_CLOSED": return "terminal";
    default: return assertNever(status);
  }
}

export function outcomeDisposition(status: OutcomeStatus): "verified" | "restored" {
  switch (status) {
    case "VERIFIED": return "verified";
    case "ROLLED_BACK": return "restored";
    default: return assertNever(status);
  }
}

export function receiptStoreDisposition(state: ReceiptStoreState): "open" | "terminal" | "missing" {
  switch (state) {
    case "ABSENT": return "missing";
    case "PENDING": return "open";
    case "LOCKED": return "open";
    case "CONSUMED": return "terminal";
    case "REJECTED": return "terminal";
    default: return assertNever(state);
  }
}

export function authorityDisposition(state: AuthorityState): "active" | "terminal" {
  switch (state) {
    case "ACTIVE": return "active";
    case "REVOKED": return "terminal";
    default: return assertNever(state);
  }
}
