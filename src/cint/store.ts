import { access, mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import type { FileHandle } from "node:fs/promises";

import {
  CintError,
  assertCint,
  assertExactKeys,
  assertJsonValue,
  canonicalJson,
  identifier,
  immutableRecord,
  isoInstant,
  parseCanonicalJson,
  sealRecord,
  sha256,
  sha256Digest,
  verifyProtocolRecord,
  verifySealedRecord
} from "./canonical.js";
import type {
  ReceiptId,
  RevalidationDigest
} from "./types/brands.js";
import type {
  ConsumedReceiptRecord,
  IssuedDecisionReceipt,
  PendingReceiptRecord
} from "./types/records.js";

interface ReceiptPaths {
  readonly pending: string;
  readonly consumed: string;
  readonly rejected: string;
  readonly lock: string;
}

export type ReceiptStoreInspection =
  | Readonly<{ state: "CONSUMED"; path: "consumed" }>
  | Readonly<{ state: "REJECTED"; path: "rejected" }>
  | Readonly<{ state: "LOCKED"; path: "locks" }>
  | Readonly<{ state: "PENDING"; path: "pending" }>
  | Readonly<{ state: "ABSENT"; path: null }>;

interface ReceiptConsumptionResult {
  readonly status?: unknown;
  readonly reason_codes?: unknown;
  readonly digest?: unknown;
}

type RevalidationCallback = (receipt: IssuedDecisionReceipt) => unknown;

function errorCode(error: unknown): unknown {
  return error !== null && (typeof error === "object" || typeof error === "function")
    ? Reflect.get(error, "code")
    : undefined;
}

function isRevalidationCallback(value: unknown): value is RevalidationCallback {
  return typeof value === "function";
}

function consumptionResult(value: unknown): ReceiptConsumptionResult {
  assertCint(value !== null && typeof value === "object", "CINT_REVALIDATION_INVALID", "Revalidation returned no result");
  return {
    status: Reflect.get(value, "status"),
    reason_codes: Reflect.get(value, "reason_codes"),
    digest: Reflect.get(value, "digest")
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (errorCode(error) === "ENOENT") return false;
    throw error;
  }
}

async function writeExclusive(filePath: string, value: unknown): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    handle = await open(filePath, "wx", 0o600);
    await handle.writeFile(canonicalJson(assertJsonValue(value)), "utf8");
    await handle.sync();
  } finally {
    if (handle) await handle.close();
  }
}

export class FileReceiptStore {
  readonly root: string;
  readonly pending: string;
  readonly consumed: string;
  readonly rejected: string;
  readonly locks: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.pending = path.join(this.root, "pending");
    this.consumed = path.join(this.root, "consumed");
    this.rejected = path.join(this.root, "rejected");
    this.locks = path.join(this.root, "locks");
  }

  async initialize(): Promise<this> {
    for (const directory of [this.pending, this.consumed, this.rejected, this.locks]) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
    }
    return this;
  }

  #paths(value: unknown): ReceiptPaths {
    const receiptId = identifier<ReceiptId>(value, "receipt id");
    const name = `${sha256(receiptId)}.json`;
    return {
      pending: path.join(this.pending, name),
      consumed: path.join(this.consumed, name),
      rejected: path.join(this.rejected, name),
      lock: path.join(this.locks, `${name}.lock`)
    };
  }

  async register(receiptValue: unknown, inputValue: unknown): Promise<PendingReceiptRecord> {
    const receipt = verifyProtocolRecord(receiptValue, "cint/decision-receipt/1", "receipt");
    assertCint(
      receipt.protocol === "cint/decision-receipt/1" && receipt.status === "ISSUED",
      "CINT_RECEIPT_PROTOCOL",
      "Store accepts only issued CINT decision receipts"
    );
    const input = assertExactKeys(inputValue, ["registered_at"], [], "receipt registration");
    await this.initialize();
    const paths = this.#paths(receipt.id);
    if ((await exists(paths.consumed)) || (await exists(paths.rejected))) {
      throw new CintError("CINT_RECEIPT_REPLAY_REJECTED", "Receipt already reached a terminal store state");
    }
    const entry = sealRecord({
      protocol: "cint/receipt-store-entry/1" as const,
      state: "PENDING" as const,
      receipt_id: receipt.id,
      receipt_digest: receipt.digest,
      registered_at: isoInstant(input["registered_at"], "receipt registered_at")
    });
    try {
      await writeExclusive(paths.pending, entry);
    } catch (error) {
      if (errorCode(error) === "EEXIST") {
        throw new CintError("CINT_RECEIPT_ALREADY_REGISTERED", "Receipt is already registered");
      }
      throw error;
    }
    return entry;
  }

  async inspect(receiptId: unknown): Promise<ReceiptStoreInspection> {
    await this.initialize();
    const paths = this.#paths(receiptId);
    if (await exists(paths.consumed)) return immutableRecord({ state: "CONSUMED", path: "consumed" });
    if (await exists(paths.rejected)) return immutableRecord({ state: "REJECTED", path: "rejected" });
    if (await exists(paths.lock)) return immutableRecord({ state: "LOCKED", path: "locks" });
    if (await exists(paths.pending)) return immutableRecord({ state: "PENDING", path: "pending" });
    return immutableRecord({ state: "ABSENT", path: null });
  }

  async consume(receiptValue: unknown, inputValue: unknown): Promise<ConsumedReceiptRecord> {
    const receipt = verifyProtocolRecord(receiptValue, "cint/decision-receipt/1", "receipt");
    assertCint(
      receipt.protocol === "cint/decision-receipt/1" && receipt.status === "ISSUED",
      "CINT_RECEIPT_PROTOCOL",
      "Store accepts only issued CINT decision receipts"
    );
    const input = assertExactKeys(inputValue, ["consumed_at", "revalidate"], [], "receipt consumption");
    const revalidate = input["revalidate"];
    assertCint(isRevalidationCallback(revalidate), "CINT_REVALIDATION_INVALID", "Receipt consumption requires a revalidation function");
    await this.initialize();
    const consumedAt = isoInstant(input["consumed_at"], "receipt consumed_at");
    const paths = this.#paths(receipt.id);
    let lock: FileHandle | undefined;
    try {
      lock = await open(paths.lock, "wx", 0o600);
      await lock.writeFile(canonicalJson({ receipt_id: receipt.id, locked_at: consumedAt }), "utf8");
      await lock.sync();
    } catch (error) {
      if (lock) await lock.close().catch(() => {});
      if (errorCode(error) === "EEXIST") {
        throw new CintError("CINT_RECEIPT_REPLAY_REJECTED", "Receipt is already in flight or consumed");
      }
      throw error;
    }

    try {
      if ((await exists(paths.consumed)) || (await exists(paths.rejected))) {
        throw new CintError("CINT_RECEIPT_REPLAY_REJECTED", "Receipt already reached a terminal store state");
      }
      const pendingText = await readFile(paths.pending, "utf8").catch((error) => {
        if (errorCode(error) === "ENOENT") return null;
        throw error;
      });
      assertCint(pendingText !== null, "CINT_RECEIPT_UNREGISTERED", "Receipt is not registered");
      const pendingEntry = parseCanonicalJson(pendingText, "pending receipt entry");
      const verifiedPendingEntry = verifySealedRecord(pendingEntry, "pending receipt entry");
      assertCint(
        verifiedPendingEntry["receipt_id"] === receipt.id && verifiedPendingEntry["receipt_digest"] === receipt.digest,
        "CINT_RECEIPT_STORE_MISMATCH",
        "Registered receipt digest does not match the presented receipt"
      );

      let rawRevalidation: unknown;
      if (Date.parse(consumedAt) >= Date.parse(receipt.expires_at)) {
        rawRevalidation = { status: "REVOKED", reason_codes: ["CINT_RECEIPT_EXPIRED"], digest: receipt.digest };
      } else {
        rawRevalidation = await revalidate(receipt);
      }
      const revalidation = consumptionResult(rawRevalidation);
      const revalidationDigest = sha256Digest<RevalidationDigest>(
        revalidation.digest ?? receipt.digest,
        "revalidation digest"
      );
      if (revalidation.status !== "VALID") {
        const reasonCodes = Array.isArray(revalidation.reason_codes)
          ? revalidation.reason_codes.map(String)
          : ["CINT_REVALIDATION_FAILED"];
        const rejectedEntry = sealRecord({
          protocol: "cint/receipt-store-entry/1" as const,
          state: "REJECTED" as const,
          receipt_id: receipt.id,
          receipt_digest: receipt.digest,
          rejected_at: consumedAt,
          revalidation_digest: revalidationDigest,
          reason_codes: reasonCodes
        });
        await writeExclusive(paths.rejected, rejectedEntry);
        await unlink(paths.pending);
        throw new CintError("CINT_RECEIPT_REVOKED", "Receipt failed immediate revalidation", {
          reason_codes: rejectedEntry.reason_codes
        });
      }
      const consumedEntry = sealRecord({
        protocol: "cint/receipt-store-entry/1" as const,
        state: "CONSUMED" as const,
        receipt_id: receipt.id,
        receipt_digest: receipt.digest,
        consumed_at: consumedAt,
        revalidation_digest: revalidationDigest
      });
      await writeExclusive(paths.consumed, consumedEntry);
      await unlink(paths.pending);
      return consumedEntry;
    } finally {
      assertCint(lock !== undefined, "CINT_RECEIPT_REPLAY_REJECTED", "Receipt lock was not acquired");
      await lock.close().catch(() => {});
      await unlink(paths.lock).catch(() => {});
    }
  }
}
