import {
  assertCint,
  assertExactKeys,
  assertJsonValue,
  canonicalDigest,
  identifier,
  integer,
  isoInstant,
  sealRecord
} from "./canonical.js";

export function createMachineStateSnapshot(input) {
  assertExactKeys(input, ["id", "epoch", "available", "state", "observed_at"], [], "machine state");
  assertCint(typeof input.available === "boolean", "CINT_MACHINE_STATE_INVALID", "machine state availability must be boolean");
  const state = assertJsonValue(input.state, "machine state value");
  return sealRecord({
    protocol: "cint/machine-state/1",
    id: identifier(input.id, "machine state id"),
    epoch: integer(input.epoch, "machine state epoch", { minimum: 1 }),
    available: input.available,
    observed_at: isoInstant(input.observed_at, "machine state observed_at"),
    state_digest: canonicalDigest(state)
  });
}
