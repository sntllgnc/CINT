import path from "node:path";

import {
  CODEX_DELEGATION_ADAPTER,
  createChildPacket,
  runGovernedChild
} from "../../../adapters/codex-delegation/index.js";
import { canonicalJson, sha256 } from "../../../util.js";
import {
  CintError,
  assertCint,
  assertExactKeys,
  canonicalDigest,
  immutableRecord,
  isoInstant,
  sealRecord,
  verifyProtocolRecord,
  verifySealedRecord
} from "../../canonical.js";
import { createAdapterCapability } from "../../challenge.js";

export function codexDelegationTaskDigest(spec) {
  const safeBinding = {
    protocol: "cint/codex-delegation-task-binding/1",
    version: spec.version,
    root_task_id: spec.root_task_id,
    worker: spec.worker,
    admission: spec.admission,
    delegation: spec.delegation,
    repository_boundary_digest: sha256(spec.repository_boundary)
  };
  return canonicalDigest(safeBinding);
}

export async function createCodexDelegationAction(spec) {
  const packetRecord = await createChildPacket(spec);
  return immutableRecord({
    adapter: "cint.adapter.codex-delegation",
    type: "CODEX_DELEGATED_REVIEW",
    target: {
      packet_sha256: packetRecord.packet_sha256
    },
    parameters: {
      legacy_task_digest: codexDelegationTaskDigest(spec)
    },
    consequence: "READ_ONLY"
  });
}

export class CodexDelegationCintAdapter {
  constructor(input) {
    assertExactKeys(input, ["spec", "output_dir"], ["codex_args", "codex_binary"], "Codex adapter configuration");
    assertCint(
      input.codex_args === undefined ||
        (Array.isArray(input.codex_args) && input.codex_args.every((value) => typeof value === "string" && value.length > 0)),
      "CINT_CODEX_ARGS_INVALID",
      "Codex adapter argument prefix must contain non-empty strings"
    );
    this.id = "cint.adapter.codex-delegation";
    this.spec = input.spec;
    this.output_dir = path.resolve(input.output_dir);
    this.codex_binary = input.codex_binary;
    this.codex_args = Object.freeze([...(input.codex_args ?? [])]);
    this.capability = createAdapterCapability({
      id: this.id,
      action_types: ["CODEX_DELEGATED_REVIEW"],
      consequence_classes: ["READ_ONLY"],
      prepare_side_effect_free: true,
      rollback: false,
      interrupt: false,
      outcome_verification: true
    });
    this.authority_boundary = CODEX_DELEGATION_ADAPTER.authority_boundary;
  }

  async prepare(intent, options) {
    verifyProtocolRecord(intent, "cint/intent/1", "intent");
    assertCint(intent.action.adapter === this.id, "CINT_ADAPTER_MISMATCH", "Intent does not target the Codex delegation adapter");
    assertCint(intent.action.type === "CODEX_DELEGATED_REVIEW", "CINT_ADAPTER_ACTION_UNSUPPORTED", "Codex adapter supports delegated review only");
    assertCint(intent.action.consequence === "READ_ONLY", "CINT_ADAPTER_CONSEQUENCE_UNSUPPORTED", "Legacy Codex adapter is read-only");
    assertExactKeys(intent.action.target, ["packet_sha256"], [], "Codex adapter target");
    assertExactKeys(intent.action.parameters, ["legacy_task_digest"], [], "Codex adapter parameters");
    const packetRecord = await createChildPacket(this.spec);
    const taskDigest = codexDelegationTaskDigest(this.spec);
    assertCint(packetRecord.packet_sha256 === intent.action.target.packet_sha256, "CINT_CODEX_PACKET_CHANGED", "Legacy child packet changed after decision");
    assertCint(taskDigest === intent.action.parameters.legacy_task_digest, "CINT_CODEX_TASK_CHANGED", "Legacy task changed after decision");
    return Object.freeze({
      packet_record: packetRecord,
      task_digest: taskDigest,
      prepared_at: isoInstant(options.at, "Codex adapter preparation time")
    });
  }

  async execute(prepared, options) {
    if (options.signal?.aborted) throw new CintError("CINT_EXECUTION_INTERRUPTED", "Codex delegation was interrupted before execution");
    const run = await runGovernedChild({
      spec: this.spec,
      outputDir: this.output_dir,
      codexBinary: this.codex_binary,
      codexArgs: this.codex_args
    });
    return sealRecord({
      protocol: "cint/codex-delegation-execution/1",
      adapter_id: this.id,
      action_type: "CODEX_DELEGATED_REVIEW",
      legacy_packet_sha256: prepared.packet_record.packet_sha256,
      legacy_task_digest: prepared.task_digest,
      legacy_run_digest: sha256(canonicalJson(run)),
      legacy_result: run.admission.result,
      context_mode: run.admission.context_mode,
      model_calls: run.admission.model_calls,
      incremental_tokens: run.admission.incremental_tokens,
      executed_at: isoInstant(options.at, "Codex adapter execution time")
    });
  }

  async verify(prepared, execution, options) {
    verifySealedRecord(execution, "Codex adapter execution");
    const matched =
      execution.adapter_id === this.id &&
      execution.legacy_packet_sha256 === prepared.packet_record.packet_sha256 &&
      execution.legacy_task_digest === prepared.task_digest &&
      ["ADMITTED", "REJECTED"].includes(execution.legacy_result) &&
      execution.context_mode === "clean";
    return sealRecord({
      protocol: "cint/outcome-verification/1",
      status: matched ? "VERIFIED" : "DIVERGED",
      target: "codex-delegation-packet",
      expected_sha256: prepared.packet_record.packet_sha256,
      actual_sha256: matched ? execution.legacy_packet_sha256 : "0".repeat(64),
      checked_at: isoInstant(options.at, "Codex adapter verification time")
    });
  }

  async rollback() {
    throw new CintError("CINT_ROLLBACK_UNSUPPORTED", "Read-only Codex delegation has no rollback operation");
  }
}
