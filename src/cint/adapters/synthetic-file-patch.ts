import { randomUUID } from "node:crypto";
import { open, readFile, realpath, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { FileHandle } from "node:fs/promises";

import {
  CintError,
  assertCint,
  assertExactKeys,
  boundedString,
  identifier,
  isoInstant,
  sealRecord,
  sha256,
  sha256Digest,
  verifyProtocolRecord,
  verifySealedRecord
} from "../canonical.js";
import { createAdapterCapability } from "../challenge.js";
import { verifyOutcomeVerification, verifyRestoredRollback } from "../outcome.js";
import type {
  AdapterId,
  CanonicalInstant,
  Identifier,
  TargetDigest
} from "../types/brands.js";
import type { AdapterOperationOptions } from "../types/adapters.js";
import type {
  AdapterCapability,
  AdapterExecution,
  FailedRollback,
  IntentRecord,
  OutcomeVerification,
  RestoredRollback
} from "../types/records.js";

interface ResolvedTarget {
  readonly absolute: string;
  readonly relative: string;
}

export interface SyntheticPreparedAction {
  readonly absolute: string;
  readonly relative: string;
  readonly mode: number;
  readonly original_bytes: Buffer;
  readonly desired_bytes: Buffer;
  readonly before_sha256: TargetDigest;
  readonly after_sha256: TargetDigest;
  readonly prepared_at: CanonicalInstant;
}

function property(value: unknown, name: string): unknown {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? Reflect.get(value, name)
    : undefined;
}

function errorCode(error: unknown): unknown {
  return property(error, "code");
}

function signalAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function isWithin(boundary: string, candidate: string): boolean {
  const relative = path.relative(boundary, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeRelativePath(value: unknown): string {
  const relative = boundedString(value, "synthetic target path", { minimum: 1, maximum: 1024 });
  assertCint(
    !path.isAbsolute(relative) && !relative.includes("\0"),
    "CINT_TARGET_INVALID",
    "Synthetic target path must be relative and NUL-free"
  );
  const normalized = path.normalize(relative);
  assertCint(
    normalized !== ".." && !normalized.startsWith(`..${path.sep}`),
    "CINT_TARGET_INVALID",
    "Synthetic target path leaves the disposable boundary"
  );
  return normalized.split(path.sep).join("/");
}

async function resolveInside(boundary: string, value: unknown): Promise<ResolvedTarget> {
  const relative = safeRelativePath(value);
  const joined = path.resolve(boundary, relative);
  assertCint(isWithin(boundary, joined), "CINT_TARGET_INVALID", "Synthetic target path leaves the disposable boundary");
  const absolute = await realpath(joined);
  assertCint(isWithin(boundary, absolute), "CINT_TARGET_INVALID", "Synthetic target resolves outside the disposable boundary");
  const metadata = await stat(absolute);
  assertCint(metadata.isFile(), "CINT_TARGET_INVALID", "Synthetic target must be a regular file");
  return { absolute, relative };
}

async function atomicWrite(filePath: string, bytes: Uint8Array, mode: number): Promise<void> {
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.cint.tmp`);
  let handle: FileHandle | undefined;
  try {
    handle = await open(temporary, "wx", mode);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, filePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

export class SyntheticFilePatchAdapter {
  readonly id: AdapterId;
  readonly root: string;
  readonly capability: AdapterCapability;

  constructor(root: string) {
    this.id = identifier<AdapterId>("cint.adapter.synthetic-file-patch", "synthetic adapter id");
    this.root = path.resolve(root);
    this.capability = createAdapterCapability({
      id: this.id,
      action_types: ["SYNTHETIC_FILE_PATCH"],
      consequence_classes: ["CONSEQUENTIAL"],
      prepare_side_effect_free: true,
      rollback: true,
      interrupt: true,
      outcome_verification: true
    });
  }

  prepare(intent: IntentRecord, options: AdapterOperationOptions): Promise<SyntheticPreparedAction>;
  async prepare(value: unknown, options: AdapterOperationOptions): Promise<SyntheticPreparedAction> {
    const intent = verifyProtocolRecord(value, "cint/intent/1", "intent");
    assertCint(intent.action.adapter === this.id, "CINT_ADAPTER_MISMATCH", "Intent does not target the synthetic adapter");
    assertCint(intent.action.type === "SYNTHETIC_FILE_PATCH", "CINT_ADAPTER_ACTION_UNSUPPORTED", "Synthetic adapter supports only file patch actions");
    const target = assertExactKeys(intent.action.target, ["path"], [], "synthetic target");
    const parameters = assertExactKeys(intent.action.parameters, ["content", "expected_before_sha256"], [], "synthetic parameters");
    const content = boundedString(parameters["content"], "synthetic content", { minimum: 0, maximum: 1024 * 1024 });
    const expectedBefore = sha256Digest<TargetDigest>(parameters["expected_before_sha256"], "synthetic expected_before_sha256");
    const boundary = await realpath(this.root).catch((error: unknown) => {
      throw new CintError("CINT_TARGET_INVALID", "Synthetic adapter root is unavailable", { cause: errorCode(error) });
    });
    const resolved = await resolveInside(boundary, target["path"]).catch((error: unknown) => {
      throw new CintError("CINT_TARGET_INVALID", "Synthetic target is outside the available disposable boundary", {
        cause: errorCode(error)
      });
    });
    const metadata = await stat(resolved.absolute);
    const originalBytes = await readFile(resolved.absolute);
    const beforeSha256 = sha256<TargetDigest>(originalBytes);
    assertCint(beforeSha256 === expectedBefore, "CINT_TARGET_STATE_CHANGED", "Synthetic target changed before execution");
    return Object.freeze({
      absolute: resolved.absolute,
      relative: resolved.relative,
      mode: metadata.mode & 0o777,
      original_bytes: Buffer.from(originalBytes),
      desired_bytes: Buffer.from(content, "utf8"),
      before_sha256: beforeSha256,
      after_sha256: sha256<TargetDigest>(Buffer.from(content, "utf8")),
      prepared_at: isoInstant(options.at, "synthetic preparation time")
    });
  }

  async execute(prepared: SyntheticPreparedAction, options: AdapterOperationOptions): Promise<AdapterExecution> {
    assertCint(!signalAborted(options.signal), "CINT_EXECUTION_INTERRUPTED", "Synthetic action was interrupted before execution");
    const currentBytes = await readFile(prepared.absolute);
    assertCint(sha256<TargetDigest>(currentBytes) === prepared.before_sha256, "CINT_TARGET_STATE_CHANGED", "Synthetic target changed after preparation");
    await atomicWrite(prepared.absolute, prepared.desired_bytes, prepared.mode);
    assertCint(!signalAborted(options.signal), "CINT_EXECUTION_INTERRUPTED", "Synthetic action was interrupted during execution");
    return sealRecord({
      protocol: "cint/synthetic-execution/1" as const,
      adapter_id: this.id,
      action_type: identifier<Identifier>("SYNTHETIC_FILE_PATCH", "synthetic action type"),
      target: prepared.relative,
      before_sha256: prepared.before_sha256,
      intended_after_sha256: prepared.after_sha256,
      bytes_written: prepared.desired_bytes.byteLength,
      executed_at: isoInstant(options.at, "synthetic execution time")
    });
  }

  async verify(
    prepared: SyntheticPreparedAction,
    execution: unknown,
    options: AdapterOperationOptions
  ): Promise<OutcomeVerification> {
    verifySealedRecord(execution, "synthetic execution");
    const currentBytes = await readFile(prepared.absolute);
    const actual = sha256<TargetDigest>(currentBytes);
    return verifyOutcomeVerification(sealRecord({
      protocol: "cint/outcome-verification/1" as const,
      status: actual === prepared.after_sha256 ? "VERIFIED" as const : "DIVERGED" as const,
      target: prepared.relative,
      expected_sha256: prepared.after_sha256,
      actual_sha256: actual,
      checked_at: isoInstant(options.at, "synthetic verification time")
    }));
  }

  async rollback(
    prepared: SyntheticPreparedAction,
    options: AdapterOperationOptions
  ): Promise<RestoredRollback | FailedRollback> {
    await atomicWrite(prepared.absolute, prepared.original_bytes, prepared.mode);
    const restored = sha256<TargetDigest>(await readFile(prepared.absolute));
    const common = {
      protocol: "cint/rollback/1" as const,
      target: prepared.relative,
      expected_sha256: prepared.before_sha256,
      actual_sha256: restored,
      rolled_back_at: isoInstant(options.at, "synthetic rollback time")
    };
    if (restored === prepared.before_sha256) {
      return verifyRestoredRollback(sealRecord({ ...common, status: "RESTORED" as const }));
    }
    return sealRecord({ ...common, status: "FAILED" as const });
  }
}
