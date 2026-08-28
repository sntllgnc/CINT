import { open, readFile, realpath, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { resolveInside, sha256 } from "../../util.js";
import {
  CintError,
  assertCint,
  assertExactKeys,
  boundedString,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifyProtocolRecord,
  verifySealedRecord
} from "../canonical.js";
import { createAdapterCapability } from "../challenge.js";

async function atomicWrite(filePath, bytes, mode) {
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.cint.tmp`);
  let handle;
  try {
    handle = await open(temporary, "wx", mode);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, filePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporary).catch(() => {});
  }
}

export class SyntheticFilePatchAdapter {
  constructor(root) {
    this.id = "cint.adapter.synthetic-file-patch";
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

  async prepare(intent, options) {
    verifyProtocolRecord(intent, "cint/intent/1", "intent");
    assertCint(intent.action.adapter === this.id, "CINT_ADAPTER_MISMATCH", "Intent does not target the synthetic adapter");
    assertCint(intent.action.type === "SYNTHETIC_FILE_PATCH", "CINT_ADAPTER_ACTION_UNSUPPORTED", "Synthetic adapter supports only file patch actions");
    assertExactKeys(intent.action.target, ["path"], [], "synthetic target");
    assertExactKeys(intent.action.parameters, ["content", "expected_before_sha256"], [], "synthetic parameters");
    const relative = boundedString(intent.action.target.path, "synthetic target path", { minimum: 1, maximum: 1024 });
    const content = boundedString(intent.action.parameters.content, "synthetic content", { minimum: 0, maximum: 1024 * 1024 });
    const expectedBefore = sha256Digest(intent.action.parameters.expected_before_sha256, "synthetic expected_before_sha256");
    const boundary = await realpath(this.root).catch((error) => {
      throw new CintError("CINT_TARGET_INVALID", "Synthetic adapter root is unavailable", { cause: error.code });
    });
    const resolved = await resolveInside(boundary, relative).catch((error) => {
      throw new CintError("CINT_TARGET_INVALID", "Synthetic target is outside the available disposable boundary", {
        cause: error.code
      });
    });
    const metadata = await stat(resolved.absolute);
    const originalBytes = await readFile(resolved.absolute);
    const beforeSha256 = sha256(originalBytes);
    assertCint(beforeSha256 === expectedBefore, "CINT_TARGET_STATE_CHANGED", "Synthetic target changed before execution");
    return Object.freeze({
      absolute: resolved.absolute,
      relative: resolved.relative,
      mode: metadata.mode & 0o777,
      original_bytes: Buffer.from(originalBytes),
      desired_bytes: Buffer.from(content, "utf8"),
      before_sha256: beforeSha256,
      after_sha256: sha256(Buffer.from(content, "utf8")),
      prepared_at: isoInstant(options.at, "synthetic preparation time")
    });
  }

  async execute(prepared, options) {
    assertCint(options.signal?.aborted !== true, "CINT_EXECUTION_INTERRUPTED", "Synthetic action was interrupted before execution");
    const currentBytes = await readFile(prepared.absolute);
    assertCint(sha256(currentBytes) === prepared.before_sha256, "CINT_TARGET_STATE_CHANGED", "Synthetic target changed after preparation");
    await atomicWrite(prepared.absolute, prepared.desired_bytes, prepared.mode);
    assertCint(options.signal?.aborted !== true, "CINT_EXECUTION_INTERRUPTED", "Synthetic action was interrupted during execution");
    return sealRecord({
      protocol: "cint/synthetic-execution/1",
      adapter_id: this.id,
      action_type: "SYNTHETIC_FILE_PATCH",
      target: prepared.relative,
      before_sha256: prepared.before_sha256,
      intended_after_sha256: prepared.after_sha256,
      bytes_written: prepared.desired_bytes.byteLength,
      executed_at: isoInstant(options.at, "synthetic execution time")
    });
  }

  async verify(prepared, execution, options) {
    verifySealedRecord(execution, "synthetic execution");
    const currentBytes = await readFile(prepared.absolute);
    const actual = sha256(currentBytes);
    return sealRecord({
      protocol: "cint/outcome-verification/1",
      status: actual === prepared.after_sha256 ? "VERIFIED" : "DIVERGED",
      target: prepared.relative,
      expected_sha256: prepared.after_sha256,
      actual_sha256: actual,
      checked_at: isoInstant(options.at, "synthetic verification time")
    });
  }

  async rollback(prepared, options) {
    await atomicWrite(prepared.absolute, prepared.original_bytes, prepared.mode);
    const restored = sha256(await readFile(prepared.absolute));
    return sealRecord({
      protocol: "cint/rollback/1",
      status: restored === prepared.before_sha256 ? "RESTORED" : "FAILED",
      target: prepared.relative,
      expected_sha256: prepared.before_sha256,
      actual_sha256: restored,
      rolled_back_at: isoInstant(options.at, "synthetic rollback time")
    });
  }
}
