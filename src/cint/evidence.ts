import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { FileHandle } from "node:fs/promises";

import {
  CintError,
  assertCint,
  assertExactKeys,
  assertJsonValue,
  canonicalDigest,
  canonicalJson,
  identifier,
  integer,
  isoInstant,
  parseCanonicalJson,
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

export interface ExecutionLedgerEntry extends SealedRecord<"cint/execution-ledger/1"> {
  readonly sequence: number;
  readonly event_id: Identifier;
  readonly type: Identifier;
  readonly at: CanonicalInstant;
  readonly previous_digest: RecordDigest | null;
  readonly payload_digest: RecordDigest;
}

function property(value: unknown, name: string): unknown {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? Reflect.get(value, name)
    : undefined;
}

function errorCode(error: unknown): unknown {
  return property(error, "code");
}

export function verifyExecutionLedgerEntry(value: unknown, label = "ledger entry"): ExecutionLedgerEntry {
  const record = verifySealedRecord(value, label);
  assertCint(
    record["protocol"] === "cint/execution-ledger/1",
    "CINT_PROTOCOL_INVALID",
    `${label} uses an unsupported protocol`
  );
  const rawPreviousDigest = record["previous_digest"];
  return {
    protocol: "cint/execution-ledger/1",
    sequence: integer(record["sequence"], `${label}.sequence`, { minimum: 1 }),
    event_id: identifier<Identifier>(record["event_id"], `${label}.event_id`),
    type: identifier<Identifier>(record["type"], `${label}.type`),
    at: isoInstant(record["at"], `${label}.at`),
    previous_digest: rawPreviousDigest === null
      ? null
      : sha256Digest<RecordDigest>(rawPreviousDigest, `${label}.previous_digest`),
    payload_digest: sha256Digest<RecordDigest>(record["payload_digest"], `${label}.payload_digest`),
    digest: sha256Digest<RecordDigest>(record["digest"], `${label}.digest`)
  };
}

export class ExecutionLedger {
  readonly file: string;
  readonly lock: string;

  constructor(filePath: string) {
    this.file = path.resolve(filePath);
    this.lock = `${this.file}.lock`;
  }

  async #entries(): Promise<readonly ExecutionLedgerEntry[]> {
    const text = await readFile(this.file, "utf8").catch((error: unknown) => {
      if (errorCode(error) === "ENOENT") return "";
      throw error;
    });
    const values = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => verifyExecutionLedgerEntry(parseCanonicalJson(line, `ledger line ${index + 1}`), `ledger entry ${index + 1}`));
    let previous: RecordDigest | null = null;
    for (let index = 0; index < values.length; index += 1) {
      const entry = values[index];
      assertCint(entry !== undefined, "CINT_LEDGER_CHAIN_INVALID", "Execution ledger entry is unavailable");
      if (entry.sequence !== index + 1 || entry.previous_digest !== previous) {
        throw new CintError("CINT_LEDGER_CHAIN_INVALID", "Execution ledger chain is invalid");
      }
      previous = entry.digest;
    }
    return values;
  }

  async record(value: unknown): Promise<ExecutionLedgerEntry> {
    const input = assertExactKeys(value, ["event_id", "type", "at", "payload"], [], "ledger event");
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    let lock: FileHandle | undefined;
    try {
      lock = await open(this.lock, "wx", 0o600);
      await lock.writeFile(canonicalJson(assertJsonValue({
        event_id: input["event_id"],
        at: input["at"]
      })), "utf8");
      await lock.sync();
    } catch (error) {
      if (lock) await lock.close().catch(() => {});
      if (errorCode(error) === "EEXIST") throw new CintError("CINT_LEDGER_LOCKED", "Execution ledger is already in use");
      throw error;
    }
    try {
      const entries = await this.#entries();
      const entry = sealRecord({
        protocol: "cint/execution-ledger/1" as const,
        sequence: entries.length + 1,
        event_id: identifier<Identifier>(input["event_id"], "ledger event id"),
        type: identifier<Identifier>(input["type"], "ledger event type"),
        at: isoInstant(input["at"], "ledger event time"),
        previous_digest: entries.at(-1)?.digest ?? null,
        payload_digest: canonicalDigest<RecordDigest>(input["payload"])
      });
      const handle = await open(this.file, "a", 0o600);
      try {
        await handle.writeFile(`${canonicalJson(assertJsonValue(entry))}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      return entry;
    } finally {
      assertCint(lock !== undefined, "CINT_LEDGER_LOCKED", "Execution ledger lock was not acquired");
      await lock.close().catch(() => {});
      await unlink(this.lock).catch(() => {});
    }
  }

  async head(): Promise<ExecutionLedgerEntry | null> {
    const entries = await this.#entries();
    return entries.at(-1) ?? null;
  }
}
