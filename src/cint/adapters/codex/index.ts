import path from "node:path";

import {
  CintError,
  assertCint,
  assertExactKeys,
  boundedString,
  canonicalDigest,
  canonicalJson,
  identifier,
  immutableRecord,
  isPlainRecord,
  isoInstant,
  sealRecord,
  sha256,
  verifyProtocolRecord,
  verifySealedRecord
} from "../../canonical.js";
import { createAdapterCapability } from "../../challenge.js";
import { verifyOutcomeVerification } from "../../outcome.js";
import {
  executeLegacyCandidate,
  LEGACY_ADAPTER_01_AUTHORITY_BOUNDARY,
  prepareLegacyPacket
} from "./legacy-adapter-boundary.js";
import type {
  AdapterId,
  CanonicalInstant,
  Identifier,
  Sha256Digest,
  TargetDigest
} from "../../types/brands.js";
import type { AdapterOperationOptions } from "../../types/adapters.js";
import type {
  AdapterCapability,
  AdapterExecution,
  CintAction,
  IntentRecord,
  OutcomeVerification
} from "../../types/records.js";

export interface CodexDelegationPreparedAction {
  readonly packet_sha256: TargetDigest;
  readonly task_digest: Sha256Digest;
  readonly prepared_at: CanonicalInstant;
}

function specField(spec: unknown, name: string): unknown {
  assertCint(isPlainRecord(spec), "CINT_CODEX_TASK_CHANGED", "Codex delegation specification must be an object");
  return spec[name];
}

export function codexDelegationTaskDigest(spec: unknown): Sha256Digest {
  const repositoryBoundary = boundedString(
    specField(spec, "repository_boundary"),
    "Codex delegation repository boundary",
    { minimum: 1, maximum: 4096 }
  );
  const safeBinding = {
    protocol: "cint/codex-delegation-task-binding/1",
    version: specField(spec, "version"),
    root_task_id: specField(spec, "root_task_id"),
    worker: specField(spec, "worker"),
    admission: specField(spec, "admission"),
    delegation: specField(spec, "delegation"),
    repository_boundary_digest: sha256(repositoryBoundary)
  };
  return canonicalDigest<Sha256Digest>(safeBinding);
}

export async function createCodexDelegationAction(spec: unknown): Promise<CintAction> {
  const packet = await prepareLegacyPacket(spec);
  return immutableRecord({
    adapter: identifier<AdapterId>("cint.adapter.codex-delegation", "Codex adapter id"),
    type: identifier<Identifier>("CODEX_DELEGATED_REVIEW", "Codex action type"),
    target: {
      packet_sha256: packet.packet_sha256
    },
    parameters: {
      legacy_task_digest: codexDelegationTaskDigest(spec)
    },
    consequence: "READ_ONLY" as const
  });
}

export class CodexDelegationCintAdapter {
  readonly id: AdapterId;
  readonly spec: unknown;
  readonly output_dir: string;
  readonly codex_binary: string | undefined;
  readonly codex_args: readonly string[];
  readonly capability: AdapterCapability;
  readonly authority_boundary = LEGACY_ADAPTER_01_AUTHORITY_BOUNDARY;

  constructor(value: unknown) {
    const input = assertExactKeys(value, ["spec", "output_dir"], ["codex_args", "codex_binary"], "Codex adapter configuration");
    const rawArgs = input["codex_args"];
    assertCint(
      rawArgs === undefined ||
        (Array.isArray(rawArgs) && rawArgs.every((item) => typeof item === "string" && item.length > 0)),
      "CINT_CODEX_ARGS_INVALID",
      "Codex adapter argument prefix must contain non-empty strings"
    );
    const rawBinary = input["codex_binary"];
    assertCint(rawBinary === undefined || typeof rawBinary === "string", "CINT_CODEX_ARGS_INVALID", "Codex binary must be a string");
    this.id = identifier<AdapterId>("cint.adapter.codex-delegation", "Codex adapter id");
    this.spec = input["spec"];
    this.output_dir = path.resolve(boundedString(input["output_dir"], "Codex adapter output directory", { maximum: 4096 }));
    this.codex_binary = rawBinary;
    this.codex_args = Object.freeze(rawArgs === undefined ? [] : [...rawArgs]);
    this.capability = createAdapterCapability({
      id: this.id,
      action_types: ["CODEX_DELEGATED_REVIEW"],
      consequence_classes: ["READ_ONLY"],
      prepare_side_effect_free: true,
      rollback: false,
      interrupt: false,
      outcome_verification: true
    });
  }

  prepare(intent: IntentRecord, options: AdapterOperationOptions): Promise<CodexDelegationPreparedAction>;
  async prepare(value: unknown, options: AdapterOperationOptions): Promise<CodexDelegationPreparedAction> {
    const intent = verifyProtocolRecord(value, "cint/intent/1", "intent");
    assertCint(intent.action.adapter === this.id, "CINT_ADAPTER_MISMATCH", "Intent does not target the Codex delegation adapter");
    assertCint(intent.action.type === "CODEX_DELEGATED_REVIEW", "CINT_ADAPTER_ACTION_UNSUPPORTED", "Codex adapter supports delegated review only");
    assertCint(intent.action.consequence === "READ_ONLY", "CINT_ADAPTER_CONSEQUENCE_UNSUPPORTED", "Legacy Codex adapter is read-only");
    const target = assertExactKeys(intent.action.target, ["packet_sha256"], [], "Codex adapter target");
    const parameters = assertExactKeys(intent.action.parameters, ["legacy_task_digest"], [], "Codex adapter parameters");
    const packet = await prepareLegacyPacket(this.spec);
    const taskDigest = codexDelegationTaskDigest(this.spec);
    assertCint(packet.packet_sha256 === target["packet_sha256"], "CINT_CODEX_PACKET_CHANGED", "Legacy child packet changed after decision");
    assertCint(taskDigest === parameters["legacy_task_digest"], "CINT_CODEX_TASK_CHANGED", "Legacy task changed after decision");
    return Object.freeze({
      packet_sha256: packet.packet_sha256,
      task_digest: taskDigest,
      prepared_at: isoInstant(options.at, "Codex adapter preparation time")
    });
  }

  async execute(prepared: CodexDelegationPreparedAction, options: AdapterOperationOptions): Promise<AdapterExecution> {
    if (options.signal?.aborted) throw new CintError("CINT_EXECUTION_INTERRUPTED", "Codex delegation was interrupted before execution");
    const run = await executeLegacyCandidate({
      spec: this.spec,
      output_dir: this.output_dir,
      codex_binary: this.codex_binary,
      codex_args: this.codex_args
    });
    return sealRecord({
      protocol: "cint/codex-delegation-execution/1" as const,
      adapter_id: this.id,
      action_type: identifier<Identifier>("CODEX_DELEGATED_REVIEW", "Codex action type"),
      legacy_packet_sha256: prepared.packet_sha256,
      legacy_task_digest: prepared.task_digest,
      legacy_run_digest: sha256<Sha256Digest>(canonicalJson(run.record)),
      legacy_result: run.result,
      context_mode: run.context_mode,
      model_calls: run.model_calls,
      incremental_tokens: run.incremental_tokens,
      executed_at: isoInstant(options.at, "Codex adapter execution time")
    });
  }

  async verify(
    prepared: CodexDelegationPreparedAction,
    execution: unknown,
    options: AdapterOperationOptions
  ): Promise<OutcomeVerification> {
    const record = verifySealedRecord(execution, "Codex adapter execution");
    const matched =
      record["protocol"] === "cint/codex-delegation-execution/1" &&
      record["adapter_id"] === this.id &&
      record["legacy_packet_sha256"] === prepared.packet_sha256 &&
      record["legacy_task_digest"] === prepared.task_digest &&
      (record["legacy_result"] === "ADMITTED" || record["legacy_result"] === "REJECTED") &&
      record["context_mode"] === "clean";
    return verifyOutcomeVerification(sealRecord({
      protocol: "cint/outcome-verification/1" as const,
      status: matched ? "VERIFIED" as const : "DIVERGED" as const,
      target: "codex-delegation-packet",
      expected_sha256: prepared.packet_sha256,
      actual_sha256: matched ? prepared.packet_sha256 : "0".repeat(64),
      checked_at: isoInstant(options.at, "Codex adapter verification time")
    }));
  }

  async rollback(): Promise<never> {
    throw new CintError("CINT_ROLLBACK_UNSUPPORTED", "Read-only Codex delegation has no rollback operation");
  }
}
