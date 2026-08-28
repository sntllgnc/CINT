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
import type { Epoch, MachineStateDigest, MachineStateId } from "./types/brands.js";
import type { MachineStateSnapshot } from "./types/records.js";

export function createMachineStateSnapshot(value: unknown): MachineStateSnapshot {
  const input = assertExactKeys(value, ["id", "epoch", "available", "state", "observed_at"], [], "machine state");
  assertCint(typeof input["available"] === "boolean", "CINT_MACHINE_STATE_INVALID", "machine state availability must be boolean");
  const state = assertJsonValue(input["state"], "machine state value");
  return sealRecord({
    protocol: "cint/machine-state/1" as const,
    id: identifier<MachineStateId>(input["id"], "machine state id"),
    epoch: integer<Epoch>(input["epoch"], "machine state epoch", { minimum: 1 }),
    available: input["available"],
    observed_at: isoInstant(input["observed_at"], "machine state observed_at"),
    state_digest: canonicalDigest<MachineStateDigest>(state)
  });
}
