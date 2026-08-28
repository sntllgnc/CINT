import {
  assertCint,
  identifier,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifySealedRecord
} from "./canonical.js";
import { verifyRestoredRollback } from "./outcome.js";
import type { Identifier, RecordDigest } from "./types/brands.js";
import type { FailedRollback, RollbackResult } from "./types/records.js";

export interface RollbackOperationOptions {
  readonly at: unknown;
  readonly signal?: AbortSignal | undefined;
}

export interface RollbackAdapter {
  rollback?(prepared: unknown, options: RollbackOperationOptions): Promise<unknown>;
}

function property(value: unknown, name: string): unknown {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? Reflect.get(value, name)
    : undefined;
}

function errorCode(error: unknown): string {
  const code = property(error, "code");
  return typeof code === "string" ? code : "CINT_ROLLBACK_FAILED";
}

function failedRollback(value: unknown): FailedRollback {
  const record = verifySealedRecord(value, "rollback failure");
  const protocol = record["protocol"];
  assertCint(
    (protocol === "cint/rollback/1" || protocol === "cint/rollback-failure/1") && record["status"] === "FAILED",
    "CINT_ROLLBACK_FAILED",
    "Rollback returned invalid failure evidence"
  );
  return {
    protocol,
    status: "FAILED",
    digest: sha256Digest<RecordDigest>(record["digest"], "rollback failure digest")
  };
}

export async function performRollback(
  adapter: RollbackAdapter,
  prepared: unknown,
  options: RollbackOperationOptions
): Promise<RollbackResult>;
export async function performRollback(
  adapterValue: unknown,
  prepared: unknown,
  options: RollbackOperationOptions
): Promise<RollbackResult> {
  try {
    const rollback = property(adapterValue, "rollback");
    assertCint(typeof rollback === "function", "CINT_ROLLBACK_UNSUPPORTED", "Adapter has no rollback operation");
    const result: unknown = await Reflect.apply(rollback, adapterValue, [prepared, options]);
    const record = verifySealedRecord(result, "rollback");
    return record["status"] === "RESTORED" ? verifyRestoredRollback(result) : failedRollback(result);
  } catch (error) {
    return sealRecord({
      protocol: "cint/rollback-failure/1" as const,
      status: "FAILED" as const,
      error_code: identifier<Identifier>(errorCode(error), "rollback failure code"),
      rolled_back_at: isoInstant(options.at, "rollback failure time")
    });
  }
}
