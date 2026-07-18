import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { PROJECT_ROOT } from "../src/demo.js";
import { auditTraceFile } from "../src/audit.js";

test("reproduces 555.3M raw while attributing only 1,492,621 request-local tokens", async () => {
  const audit = await auditTraceFile(
    path.join(PROJECT_ROOT, "fixtures", "sanitized-af-g0", "traces", "r1-full-history.jsonl"),
    { kind: "rollout", worker: "r1_audience_reproduction" }
  );
  assert.equal(audit.context_mode, "full_history");
  assert.equal(audit.full_history_detected, true);
  assert.equal(audit.raw_cumulative_tokens, 555_300_000);
  assert.equal(audit.incremental_tokens, 1_492_621);
  assert.equal(audit.cached_input_tokens, 1_380_352);
  assert.equal(audit.fresh_input_tokens, 103_132);
  assert.equal(audit.output_tokens, 9_137);
  assert.equal(audit.model_calls, 16);
  assert.equal(audit.duplicate_usage_events, 1);
  assert.equal(audit.cumulative_delta_matches_incremental, true);
});

test("audits clean codex exec JSONL as request-local usage", async () => {
  const audit = await auditTraceFile(
    path.join(PROJECT_ROOT, "fixtures", "sanitized-af-g0", "traces", "r1-clean-worker.jsonl"),
    { kind: "codex", contextMode: "clean" }
  );
  assert.equal(audit.context_mode, "clean");
  assert.equal(audit.raw_cumulative_tokens, null);
  assert.equal(audit.incremental_tokens, 1_492_621);
  assert.equal(audit.model_calls, 16);
});
