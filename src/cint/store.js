import { access, mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { canonicalJson, sha256 } from "../util.js";
import {
  CintError,
  assertCint,
  assertExactKeys,
  identifier,
  immutableRecord,
  isoInstant,
  parseCanonicalJson,
  sealRecord,
  sha256Digest,
  verifyProtocolRecord,
  verifySealedRecord
} from "./canonical.js";

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function writeExclusive(filePath, value) {
  let handle;
  try {
    handle = await open(filePath, "wx", 0o600);
    await handle.writeFile(canonicalJson(value), "utf8");
    await handle.sync();
  } finally {
    if (handle) await handle.close();
  }
}

export class FileReceiptStore {
  constructor(root) {
    this.root = path.resolve(root);
    this.pending = path.join(this.root, "pending");
    this.consumed = path.join(this.root, "consumed");
    this.rejected = path.join(this.root, "rejected");
    this.locks = path.join(this.root, "locks");
  }

  async initialize() {
    for (const directory of [this.pending, this.consumed, this.rejected, this.locks]) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
    }
    return this;
  }

  #paths(receiptId) {
    identifier(receiptId, "receipt id");
    const name = `${sha256(receiptId)}.json`;
    return {
      pending: path.join(this.pending, name),
      consumed: path.join(this.consumed, name),
      rejected: path.join(this.rejected, name),
      lock: path.join(this.locks, `${name}.lock`)
    };
  }

  async register(receipt, input) {
    verifyProtocolRecord(receipt, "cint/decision-receipt/1", "receipt");
    assertCint(
      receipt.protocol === "cint/decision-receipt/1" && receipt.status === "ISSUED",
      "CINT_RECEIPT_PROTOCOL",
      "Store accepts only issued CINT decision receipts"
    );
    assertExactKeys(input, ["registered_at"], [], "receipt registration");
    await this.initialize();
    const paths = this.#paths(receipt.id);
    if ((await exists(paths.consumed)) || (await exists(paths.rejected))) {
      throw new CintError("CINT_RECEIPT_REPLAY_REJECTED", "Receipt already reached a terminal store state");
    }
    const entry = sealRecord({
      protocol: "cint/receipt-store-entry/1",
      state: "PENDING",
      receipt_id: receipt.id,
      receipt_digest: receipt.digest,
      registered_at: isoInstant(input.registered_at, "receipt registered_at")
    });
    try {
      await writeExclusive(paths.pending, entry);
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new CintError("CINT_RECEIPT_ALREADY_REGISTERED", "Receipt is already registered");
      }
      throw error;
    }
    return entry;
  }

  async inspect(receiptId) {
    await this.initialize();
    const paths = this.#paths(receiptId);
    if (await exists(paths.consumed)) return immutableRecord({ state: "CONSUMED", path: "consumed" });
    if (await exists(paths.rejected)) return immutableRecord({ state: "REJECTED", path: "rejected" });
    if (await exists(paths.lock)) return immutableRecord({ state: "LOCKED", path: "locks" });
    if (await exists(paths.pending)) return immutableRecord({ state: "PENDING", path: "pending" });
    return immutableRecord({ state: "ABSENT", path: null });
  }

  async consume(receipt, input) {
    verifyProtocolRecord(receipt, "cint/decision-receipt/1", "receipt");
    assertCint(
      receipt.protocol === "cint/decision-receipt/1" && receipt.status === "ISSUED",
      "CINT_RECEIPT_PROTOCOL",
      "Store accepts only issued CINT decision receipts"
    );
    assertExactKeys(input, ["consumed_at", "revalidate"], [], "receipt consumption");
    assertCint(typeof input.revalidate === "function", "CINT_REVALIDATION_INVALID", "Receipt consumption requires a revalidation function");
    await this.initialize();
    const consumedAt = isoInstant(input.consumed_at, "receipt consumed_at");
    const paths = this.#paths(receipt.id);
    let lock;
    try {
      lock = await open(paths.lock, "wx", 0o600);
      await lock.writeFile(canonicalJson({ receipt_id: receipt.id, locked_at: consumedAt }), "utf8");
      await lock.sync();
    } catch (error) {
      if (lock) await lock.close().catch(() => {});
      if (error.code === "EEXIST") {
        throw new CintError("CINT_RECEIPT_REPLAY_REJECTED", "Receipt is already in flight or consumed");
      }
      throw error;
    }

    try {
      if ((await exists(paths.consumed)) || (await exists(paths.rejected))) {
        throw new CintError("CINT_RECEIPT_REPLAY_REJECTED", "Receipt already reached a terminal store state");
      }
      const pendingText = await readFile(paths.pending, "utf8").catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      assertCint(pendingText !== null, "CINT_RECEIPT_UNREGISTERED", "Receipt is not registered");
      const pendingEntry = parseCanonicalJson(pendingText, "pending receipt entry");
      verifySealedRecord(pendingEntry, "pending receipt entry");
      assertCint(
        pendingEntry.receipt_id === receipt.id && pendingEntry.receipt_digest === receipt.digest,
        "CINT_RECEIPT_STORE_MISMATCH",
        "Registered receipt digest does not match the presented receipt"
      );

      let revalidation;
      if (Date.parse(consumedAt) >= Date.parse(receipt.expires_at)) {
        revalidation = { status: "REVOKED", reason_codes: ["CINT_RECEIPT_EXPIRED"], digest: receipt.digest };
      } else {
        revalidation = await input.revalidate(receipt);
      }
      assertCint(revalidation && typeof revalidation === "object", "CINT_REVALIDATION_INVALID", "Revalidation returned no result");
      const revalidationDigest = revalidation.digest ?? receipt.digest;
      sha256Digest(revalidationDigest, "revalidation digest");
      if (revalidation.status !== "VALID") {
        const rejectedEntry = sealRecord({
          protocol: "cint/receipt-store-entry/1",
          state: "REJECTED",
          receipt_id: receipt.id,
          receipt_digest: receipt.digest,
          rejected_at: consumedAt,
          revalidation_digest: revalidationDigest,
          reason_codes: Array.isArray(revalidation.reason_codes) ? revalidation.reason_codes.map(String) : ["CINT_REVALIDATION_FAILED"]
        });
        await writeExclusive(paths.rejected, rejectedEntry);
        await unlink(paths.pending);
        throw new CintError("CINT_RECEIPT_REVOKED", "Receipt failed immediate revalidation", {
          reason_codes: rejectedEntry.reason_codes
        });
      }
      const consumedEntry = sealRecord({
        protocol: "cint/receipt-store-entry/1",
        state: "CONSUMED",
        receipt_id: receipt.id,
        receipt_digest: receipt.digest,
        consumed_at: consumedAt,
        revalidation_digest: revalidationDigest
      });
      await writeExclusive(paths.consumed, consumedEntry);
      await unlink(paths.pending);
      return consumedEntry;
    } finally {
      await lock.close().catch(() => {});
      await unlink(paths.lock).catch(() => {});
    }
  }
}
