import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { canonicalJson } from "../util.js";
import {
  CintError,
  assertExactKeys,
  canonicalDigest,
  identifier,
  isoInstant,
  parseCanonicalJson,
  sealRecord,
  verifySealedRecord
} from "./canonical.js";

export class ExecutionLedger {
  constructor(filePath) {
    this.file = path.resolve(filePath);
    this.lock = `${this.file}.lock`;
  }

  async #entries() {
    const text = await readFile(this.file, "utf8").catch((error) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    const entries = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line, index) => parseCanonicalJson(line, `ledger line ${index + 1}`));
    let previous = null;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      verifySealedRecord(entry, `ledger entry ${index + 1}`);
      if (entry.sequence !== index + 1 || entry.previous_digest !== previous) {
        throw new CintError("CINT_LEDGER_CHAIN_INVALID", "Execution ledger chain is invalid");
      }
      previous = entry.digest;
    }
    return entries;
  }

  async record(input) {
    assertExactKeys(input, ["event_id", "type", "at", "payload"], [], "ledger event");
    await mkdir(path.dirname(this.file), { recursive: true, mode: 0o700 });
    let lock;
    try {
      lock = await open(this.lock, "wx", 0o600);
      await lock.writeFile(canonicalJson({ event_id: input.event_id, at: input.at }), "utf8");
      await lock.sync();
    } catch (error) {
      if (lock) await lock.close().catch(() => {});
      if (error.code === "EEXIST") throw new CintError("CINT_LEDGER_LOCKED", "Execution ledger is already in use");
      throw error;
    }
    try {
      const entries = await this.#entries();
      const entry = sealRecord({
        protocol: "cint/execution-ledger/1",
        sequence: entries.length + 1,
        event_id: identifier(input.event_id, "ledger event id"),
        type: identifier(input.type, "ledger event type"),
        at: isoInstant(input.at, "ledger event time"),
        previous_digest: entries.at(-1)?.digest ?? null,
        payload_digest: canonicalDigest(input.payload)
      });
      const handle = await open(this.file, "a", 0o600);
      try {
        await handle.writeFile(`${canonicalJson(entry)}\n`, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      return entry;
    } finally {
      await lock.close().catch(() => {});
      await unlink(this.lock).catch(() => {});
    }
  }

  async head() {
    const entries = await this.#entries();
    return entries.at(-1) ?? null;
  }
}
