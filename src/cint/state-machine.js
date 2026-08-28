import {
  assertCint,
  assertExactKeys,
  identifier,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifySealedRecord
} from "./canonical.js";

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
]);

const TRANSITIONS = Object.freeze({
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

export function createStateMachine(input) {
  assertExactKeys(input, ["id", "subject_id", "created_at"], [], "state machine");
  const createdAt = isoInstant(input.created_at, "state machine created_at");
  return sealRecord({
    protocol: "cint/state-machine/1",
    id: identifier(input.id, "state machine id"),
    subject_id: identifier(input.subject_id, "state machine subject id"),
    state: "REQUESTED",
    sequence: 0,
    history: [{ state: "REQUESTED", at: createdAt, evidence_digest: null }]
  });
}

export function transitionState(machine, input) {
  verifySealedRecord(machine, "state machine");
  assertExactKeys(input, ["state", "at", "evidence_digest"], [], "state transition");
  assertCint(CINT_STATES.includes(input.state), "CINT_STATE_INVALID", `Unknown CINT state: ${input.state}`);
  assertCint(TRANSITIONS[machine.state].includes(input.state), "CINT_STATE_TRANSITION", `Transition ${machine.state} -> ${input.state} is forbidden`);
  if (input.evidence_digest !== null) sha256Digest(input.evidence_digest, "state transition evidence digest");
  const unsigned = Object.fromEntries(Object.entries(machine).filter(([key]) => key !== "digest"));
  return sealRecord({
    ...unsigned,
    state: input.state,
    sequence: machine.sequence + 1,
    history: [
      ...machine.history,
      {
        state: input.state,
        at: isoInstant(input.at, "state transition time"),
        evidence_digest: input.evidence_digest
      }
    ]
  });
}
