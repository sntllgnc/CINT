import {
  createChildPacket,
  runGovernedChild
} from "../../../adapters/codex-delegation/index.js";

import {
  assertCint,
  assertJsonValue,
  integer,
  isPlainRecord,
  sha256Digest
} from "../../canonical.js";
import type { TargetDigest } from "../../types/brands.js";
import type { JsonValue } from "../../types/protocols.js";

export const LEGACY_ADAPTER_01_AUTHORITY_BOUNDARY = Object.freeze({
  may_mint_decision: false,
  may_issue_receipt: false,
  may_consume_receipt: false,
  may_self_admit: false,
  may_bypass_revalidation: false,
  may_seal_outcome: false
} as const);

export interface LegacyPacketCandidate {
  readonly packet_sha256: TargetDigest;
}

export interface LegacyRunCandidate {
  readonly record: JsonValue;
  readonly result: "ADMITTED" | "REJECTED";
  readonly context_mode: string;
  readonly model_calls: number;
  readonly incremental_tokens: number | null;
}

export interface LegacyExecutionInput {
  readonly spec: unknown;
  readonly output_dir: string;
  readonly codex_binary?: string | undefined;
  readonly codex_args?: readonly string[] | undefined;
}

function requiredRecord(value: unknown, label: string): Readonly<Record<string, unknown>> {
  assertCint(isPlainRecord(value), "CINT_FAIL_CLOSED", `${label} must be an object`);
  return value;
}

export async function prepareLegacyPacket(spec: unknown): Promise<LegacyPacketCandidate> {
  const packet = requiredRecord(await createChildPacket(spec), "Legacy child packet");
  return Object.freeze({
    packet_sha256: sha256Digest<TargetDigest>(packet["packet_sha256"], "legacy packet sha256")
  });
}

export async function executeLegacyCandidate(input: LegacyExecutionInput): Promise<LegacyRunCandidate> {
  const raw = await runGovernedChild({
    spec: input.spec,
    outputDir: input.output_dir,
    codexBinary: input.codex_binary,
    codexArgs: input.codex_args
  });
  const record = requiredRecord(raw, "Legacy Adapter 01 run");
  const admission = requiredRecord(record["admission"], "Legacy Adapter 01 admission");
  const result = admission["result"];
  assertCint(
    result === "ADMITTED" || result === "REJECTED",
    "CINT_FAIL_CLOSED",
    "Legacy Adapter 01 returned an invalid admission result"
  );
  const contextMode = admission["context_mode"];
  assertCint(typeof contextMode === "string", "CINT_FAIL_CLOSED", "Legacy Adapter 01 context mode is invalid");
  const rawIncrementalTokens = admission["incremental_tokens"];
  const incrementalTokens = rawIncrementalTokens === null
    ? null
    : integer(rawIncrementalTokens, "Legacy Adapter 01 incremental tokens");
  return Object.freeze({
    record: assertJsonValue(raw, "Legacy Adapter 01 run"),
    result,
    context_mode: contextMode,
    model_calls: integer(admission["model_calls"], "Legacy Adapter 01 model calls"),
    incremental_tokens: incrementalTokens
  });
}
