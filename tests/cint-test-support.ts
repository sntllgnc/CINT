import assert from "node:assert/strict";

import {
  executeWithReceipt,
  isPlainRecord,
  verifyProtocolRecord
} from "../src/cint/index.js";
import type { DecisionReceiptAuthority } from "../src/cint/receipt.js";
import type {
  AdmitDecision,
  Decision,
  ExecutionResult,
  IssuedDecisionReceipt
} from "../src/cint/types/records.js";
import type { JsonRecord } from "../src/cint/canonical.js";

export function property(value: unknown, name: string): unknown {
  return value !== null && (typeof value === "object" || typeof value === "function")
    ? Reflect.get(value, name)
    : undefined;
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return property(error, "code") === code;
}

export function errorTextIncludes(error: unknown, name: string, expected: string): boolean {
  const value = property(error, name);
  return typeof value === "string" && value.includes(expected);
}

export function parseJsonRecord(text: string): JsonRecord {
  const value: unknown = JSON.parse(text);
  assert.ok(isPlainRecord(value), "expected parsed JSON object");
  return value;
}

export function requireAdmit(decision: Decision): AdmitDecision {
  assert.equal(decision.status, "ADMIT", "test fixture must produce ADMIT");
  if (decision.status !== "ADMIT") throw new Error("unreachable non-ADMIT fixture");
  return decision;
}

export function hasReason(decision: Decision, reason: string): boolean {
  return decision.reason_codes.some((candidate) => candidate === reason);
}

export function issueUntrusted(
  authority: DecisionReceiptAuthority,
  input: unknown
): IssuedDecisionReceipt {
  const value: unknown = Reflect.apply(authority.issue, authority, [input]);
  return verifyProtocolRecord(value, "cint/decision-receipt/1", "test receipt");
}

export function executeUntrusted(input: unknown): Promise<ExecutionResult> {
  const value: unknown = Reflect.apply(executeWithReceipt, undefined, [input]);
  assert.ok(value instanceof Promise, "execution boundary must return a promise");
  return value.then((result: unknown) =>
    verifyProtocolRecord(result, "cint/execution-result/1", "test execution result")
  );
}
