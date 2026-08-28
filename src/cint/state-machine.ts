import {
  assertCint,
  assertExactKeys,
  identifier,
  integer,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifySealedRecord
} from "./canonical.js";
import type {
  CanonicalInstant,
  Identifier,
  RecordDigest
} from "./types/brands.js";
import type { SealedRecord } from "./types/records.js";
import type { CintLifecycleState } from "./types/states.js";

export const CINT_STATES = Object.freeze([
  "REQUESTED",
  "CHALLENGED",
  "DENIED",
  "REVIEW",
  "ADMITTED",
  "RECEIPT_ISSUED",
  "REVALIDATED",
  "REVOKED",
  "RECEIPT_CONSUMED",
  "EXECUTING",
  "INTERRUPTED",
  "VERIFIED",
  "ROLLED_BACK",
  "SEALED",
  "FAIL_CLOSED",
  "REPLAY_REJECTED"
] as const);

const TRANSITIONS: Readonly<Record<CintLifecycleState, readonly CintLifecycleState[]>> = Object.freeze({
  REQUESTED: ["CHALLENGED", "FAIL_CLOSED"],
  CHALLENGED: ["DENIED", "REVIEW", "ADMITTED", "FAIL_CLOSED"],
  ADMITTED: ["RECEIPT_ISSUED", "REVOKED", "FAIL_CLOSED"],
  RECEIPT_ISSUED: ["REVALIDATED", "REVOKED", "REPLAY_REJECTED", "FAIL_CLOSED"],
  REVALIDATED: ["RECEIPT_CONSUMED", "REVOKED", "REPLAY_REJECTED", "FAIL_CLOSED"],
  RECEIPT_CONSUMED: ["EXECUTING", "FAIL_CLOSED"],
  EXECUTING: ["VERIFIED", "INTERRUPTED", "ROLLED_BACK", "FAIL_CLOSED"],
  INTERRUPTED: ["ROLLED_BACK", "FAIL_CLOSED"],
  VERIFIED: ["SEALED", "ROLLED_BACK", "FAIL_CLOSED"],
  DENIED: [],
  REVIEW: [],
  REVOKED: [],
  ROLLED_BACK: ["SEALED"],
  SEALED: [],
  FAIL_CLOSED: [],
  REPLAY_REJECTED: []
});

export interface StateHistoryEntry {
  readonly state: CintLifecycleState;
  readonly at: CanonicalInstant;
  readonly evidence_digest: RecordDigest | null;
}

export interface CintStateMachine extends SealedRecord<"cint/state-machine/1"> {
  readonly id: Identifier;
  readonly subject_id: Identifier;
  readonly state: CintLifecycleState;
  readonly sequence: number;
  readonly history: readonly StateHistoryEntry[];
}

function lifecycleState(value: unknown): CintLifecycleState {
  switch (value) {
    case "REQUESTED":
    case "CHALLENGED":
    case "DENIED":
    case "REVIEW":
    case "ADMITTED":
    case "RECEIPT_ISSUED":
    case "REVALIDATED":
    case "REVOKED":
    case "RECEIPT_CONSUMED":
    case "EXECUTING":
    case "INTERRUPTED":
    case "VERIFIED":
    case "ROLLED_BACK":
    case "SEALED":
    case "FAIL_CLOSED":
    case "REPLAY_REJECTED":
      return value;
    default:
      assertCint(false, "CINT_STATE_INVALID", `Unknown CINT state: ${String(value)}`);
  }
}

function stateHistory(value: unknown): readonly StateHistoryEntry[] {
  assertCint(Array.isArray(value), "CINT_STATE_INVALID", "State machine history must be an array");
  return value.map((entry, index) => {
    const checked = assertExactKeys(entry, ["state", "at", "evidence_digest"], [], `state history[${index}]`);
    const rawEvidenceDigest = checked["evidence_digest"];
    return {
      state: lifecycleState(checked["state"]),
      at: isoInstant(checked["at"], `state history[${index}].at`),
      evidence_digest: rawEvidenceDigest === null
        ? null
        : sha256Digest<RecordDigest>(rawEvidenceDigest, `state history[${index}].evidence_digest`)
    };
  });
}

function verifyStateMachine(value: unknown): CintStateMachine {
  const record = verifySealedRecord(value, "state machine");
  assertCint(record["protocol"] === "cint/state-machine/1", "CINT_PROTOCOL_INVALID", "State machine uses an unsupported protocol");
  return {
    protocol: "cint/state-machine/1",
    id: identifier<Identifier>(record["id"], "state machine id"),
    subject_id: identifier<Identifier>(record["subject_id"], "state machine subject id"),
    state: lifecycleState(record["state"]),
    sequence: integer(record["sequence"], "state machine sequence"),
    history: stateHistory(record["history"]),
    digest: sha256Digest<RecordDigest>(record["digest"], "state machine digest")
  };
}

export function createStateMachine(value: unknown): CintStateMachine {
  const input = assertExactKeys(value, ["id", "subject_id", "created_at"], [], "state machine");
  const createdAt = isoInstant(input["created_at"], "state machine created_at");
  return sealRecord({
    protocol: "cint/state-machine/1" as const,
    id: identifier<Identifier>(input["id"], "state machine id"),
    subject_id: identifier<Identifier>(input["subject_id"], "state machine subject id"),
    state: "REQUESTED" as const,
    sequence: 0,
    history: [{ state: "REQUESTED", at: createdAt, evidence_digest: null }]
  });
}

export function transitionState(machineValue: unknown, inputValue: unknown): CintStateMachine {
  const machine = verifyStateMachine(machineValue);
  const input = assertExactKeys(inputValue, ["state", "at", "evidence_digest"], [], "state transition");
  const nextState = lifecycleState(input["state"]);
  assertCint(TRANSITIONS[machine.state].includes(nextState), "CINT_STATE_TRANSITION", `Transition ${machine.state} -> ${nextState} is forbidden`);
  const rawEvidenceDigest = input["evidence_digest"];
  const evidenceDigest = rawEvidenceDigest === null
    ? null
    : sha256Digest<RecordDigest>(rawEvidenceDigest, "state transition evidence digest");
  const { digest: _digest, ...unsigned } = machine;
  return sealRecord({
    ...unsigned,
    state: nextState,
    sequence: machine.sequence + 1,
    history: [
      ...machine.history,
      {
        state: nextState,
        at: isoInstant(input["at"], "state transition time"),
        evidence_digest: evidenceDigest
      }
    ]
  });
}
