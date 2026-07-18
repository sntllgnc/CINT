import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { admitWorkerResult } from "./admission.js";
import { auditTraceFile } from "./audit.js";
import { AgentFloorError } from "./errors.js";
import { createChildPacket } from "./packet.js";
import { loadTaskSpec, validateTaskSpec } from "./policy.js";
import { formatMillions, writeJsonAtomic } from "./util.js";

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEMO_SPEC = path.join(PROJECT_ROOT, "examples", "demo-task.json");

export async function runDemo(options = {}) {
  const outputDir = path.resolve(
    options.outputDir ?? path.join(PROJECT_ROOT, "artifacts", "generated")
  );
  const { spec, raw } = await loadTaskSpec(DEMO_SPEC);
  const packetRecord = await createChildPacket(spec);

  let fullHistoryProbe;
  try {
    const invalid = structuredClone(raw);
    invalid.delegation.fork_turns = "all";
    await validateTaskSpec(invalid, { specDir: path.dirname(DEMO_SPEC) });
    fullHistoryProbe = { requested: "all", result: "ACCEPTED", code: null };
  } catch (error) {
    fullHistoryProbe = {
      requested: "all",
      result: "REJECTED",
      code: error.code ?? "AF_INTERNAL_ERROR",
      message: error.message
    };
  }

  const fixtureRoot = path.join(PROJECT_ROOT, "fixtures", "sanitized-af-g0");
  const historicalTrace = path.join(fixtureRoot, "traces", "r1-full-history.jsonl");
  const cleanTrace = path.join(fixtureRoot, "traces", "r1-clean-worker.jsonl");
  const workerOutputPath = path.join(fixtureRoot, "results", "r1-worker-output.json");
  const contradictoryOutputPath = path.join(
    PROJECT_ROOT,
    "fixtures",
    "sanitized-af-g0",
    "results",
    "r1-contradictory-output.json"
  );
  const historical = await auditTraceFile(historicalTrace, {
    kind: "rollout",
    worker: spec.worker.id
  });
  const clean = await auditTraceFile(cleanTrace, { kind: "codex", contextMode: "clean" });
  const workerOutput = JSON.parse(await readFile(workerOutputPath, "utf8"));
  const admission = await admitWorkerResult({
    spec,
    packetRecord,
    audit: clean,
    output: workerOutput,
    runtime: {
      exitCode: 0,
      outputBytes: Buffer.byteLength(JSON.stringify(workerOutput), "utf8"),
      violations: []
    }
  });
  const contradictoryOutput = JSON.parse(await readFile(contradictoryOutputPath, "utf8"));
  const semanticRejection = await admitWorkerResult({
    spec,
    packetRecord,
    audit: clean,
    output: contradictoryOutput,
    runtime: {
      exitCode: 0,
      outputBytes: Buffer.byteLength(JSON.stringify(contradictoryOutput), "utf8"),
      violations: []
    }
  });

  const checks = {
    clean_child_packet:
      packetRecord.packet.context.mode === "clean" &&
      packetRecord.packet.context.inherited_turns === 0 &&
      packetRecord.packet_bytes <= 8 * 1024,
    full_history_mechanically_rejected:
      fullHistoryProbe.result === "REJECTED" &&
      fullHistoryProbe.code === "AF_CONTEXT_FULL_HISTORY_FORBIDDEN",
    bounded_execution:
      spec.delegation.max_depth === 1 &&
      spec.delegation.max_concurrency <= 2 &&
      spec.delegation.max_cycles <= 6,
    request_local_usage_verified:
      historical.incremental_tokens === 1_492_621 &&
      historical.cumulative_delta_matches_incremental === true &&
      clean.incremental_tokens === historical.incremental_tokens,
    raw_replay_reproduced: historical.raw_cumulative_tokens === 555_300_000,
    evidence_deterministically_admitted: admission.result === "ADMITTED",
    contradictory_claim_deterministically_rejected:
      semanticRejection.result === "REJECTED" &&
      semanticRejection.rejection_reasons.some((reason) => reason.code === "AF_FORBIDDEN_TERM_PRESENT"),
    private_repository_not_required: spec.repository_boundary.startsWith(fixtureRoot)
  };
  const verdict = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  const record = {
    gate: "AF-G0 — GOVERNED CHILD EXECUTION",
    verdict,
    worker: spec.worker.id,
    context_mode: "clean",
    fork_turns: "none",
    model: spec.delegation.model,
    reasoning_effort: spec.delegation.reasoning_effort,
    model_calls: clean.model_calls,
    incremental_tokens: clean.incremental_tokens,
    cached_input_tokens: clean.cached_input_tokens,
    fresh_input_tokens: clean.fresh_input_tokens,
    output_tokens: clean.output_tokens,
    result: admission.result,
    finding_code: admission.finding_code,
    finding: admission.finding,
    evidence: admission.evidence,
    lineage: packetRecord.lineage,
    full_history_probe: fullHistoryProbe,
    historical_regression: {
      source_context_mode: historical.context_mode,
      source_fork_turns: historical.fork_turns,
      raw_cumulative_tokens: historical.raw_cumulative_tokens,
      raw_label: formatMillions(historical.raw_cumulative_tokens),
      request_local_incremental_tokens: historical.incremental_tokens,
      incremental_label: formatMillions(historical.incremental_tokens),
      naive_overstatement_tokens: historical.naive_overstatement_tokens,
      naive_overstatement_factor: historical.naive_overstatement_factor,
      duplicate_usage_events_removed: historical.duplicate_usage_events,
      cumulative_delta_matches_incremental: historical.cumulative_delta_matches_incremental,
      inherited_baseline_note:
        "The sanitized inherited baseline is normalized to the reported 555.3M headline; all 16 request-local usage deltas preserve the measured case totals."
    },
    semantic_negative_control: {
      result: semanticRejection.result,
      finding: semanticRejection.finding,
      real_evidence: semanticRejection.evidence,
      rejection_codes: semanticRejection.rejection_reasons.map((reason) => reason.code)
    },
    checks,
    judge_command: "npm run demo"
  };

  await writeJsonAtomic(path.join(outputDir, "packet.json"), packetRecord);
  await writeJsonAtomic(path.join(outputDir, "historical-audit.json"), historical);
  await writeJsonAtomic(path.join(outputDir, "clean-audit.json"), clean);
  await writeJsonAtomic(path.join(outputDir, "admission.json"), admission);
  await writeJsonAtomic(path.join(outputDir, "semantic-rejection.json"), semanticRejection);
  await writeJsonAtomic(path.join(outputDir, "af-g0.json"), record);

  if (verdict !== "PASS") {
    throw new AgentFloorError("AF_G0_FAILED", "One or more AF-G0 checks failed", { checks }, 1);
  }
  return record;
}
