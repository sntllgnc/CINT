import { readFile } from "node:fs/promises";
import { AgentFloorError, assertFloor } from "./errors.js";
import { asFiniteInteger, canonicalJson, parseJsonLines, sha256 } from "./util.js";

function normalizeUsage(raw, label) {
  assertFloor(raw && typeof raw === "object", "AF_USAGE_MALFORMED", `${label} is missing`);
  const input = asFiniteInteger(raw.input_tokens ?? 0, `${label}.input_tokens`);
  const cached = asFiniteInteger(raw.cached_input_tokens ?? 0, `${label}.cached_input_tokens`);
  const output = asFiniteInteger(raw.output_tokens ?? 0, `${label}.output_tokens`);
  const reasoning = asFiniteInteger(raw.reasoning_output_tokens ?? 0, `${label}.reasoning_output_tokens`);
  assertFloor(cached <= input, "AF_USAGE_MALFORMED", `${label} cached input exceeds total input`);
  const computedTotal = input + output;
  if (raw.total_tokens !== undefined && raw.total_tokens !== null) {
    const suppliedTotal = asFiniteInteger(raw.total_tokens, `${label}.total_tokens`);
    assertFloor(
      suppliedTotal === computedTotal,
      "AF_USAGE_MALFORMED",
      `${label} total_tokens does not equal input_tokens + output_tokens`,
      { suppliedTotal, computedTotal }
    );
  }
  return {
    input_tokens: input,
    cached_input_tokens: cached,
    fresh_input_tokens: input - cached,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: computedTotal
  };
}

function sumUsage(records) {
  return records.reduce(
    (sum, record) => ({
      input_tokens: sum.input_tokens + record.input_tokens,
      cached_input_tokens: sum.cached_input_tokens + record.cached_input_tokens,
      fresh_input_tokens: sum.fresh_input_tokens + record.fresh_input_tokens,
      output_tokens: sum.output_tokens + record.output_tokens,
      reasoning_output_tokens: sum.reasoning_output_tokens + record.reasoning_output_tokens,
      total_tokens: sum.total_tokens + record.total_tokens
    }),
    {
      input_tokens: 0,
      cached_input_tokens: 0,
      fresh_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 0
    }
  );
}

export function auditCodexEvents(events, options = {}) {
  assertFloor(Array.isArray(events), "AF_USAGE_MALFORMED", "Codex events must be an array");
  const usages = [];
  let failed = false;
  let threadId = null;
  for (const event of events) {
    if (event?.type === "thread.started") threadId = event.thread_id ?? null;
    if (event?.type === "turn.failed" || event?.type === "error") failed = true;
    if (event?.type === "turn.completed" && event.usage) {
      usages.push(normalizeUsage(event.usage, `turn.completed[${usages.length}]`));
    }
  }
  assertFloor(usages.length > 0, "AF_USAGE_MISSING", "No turn.completed usage events were found");
  const total = sumUsage(usages);
  return {
    source: "codex-exec-jsonl",
    thread_id: threadId,
    context_mode: options.contextMode ?? "clean",
    full_history_detected: false,
    model_calls: usages.length,
    input_tokens: total.input_tokens,
    cached_input_tokens: total.cached_input_tokens,
    fresh_input_tokens: total.fresh_input_tokens,
    output_tokens: total.output_tokens,
    reasoning_output_tokens: total.reasoning_output_tokens,
    incremental_tokens: total.total_tokens,
    raw_cumulative_tokens: null,
    accounting_status: failed ? "RUN_FAILED_WITH_USAGE" : "REQUEST_LOCAL",
    duplicate_usage_events: 0
  };
}

function totalTokenValue(event) {
  const value = event?.payload?.info?.total_token_usage?.total_tokens;
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function isBoundary(event, worker) {
  if (event?.type === "agent_floor.boundary") {
    return !worker || event?.payload?.worker === worker;
  }
  return event?.type === "event_msg" && event?.payload?.type === "agent_floor.boundary" && (!worker || event?.payload?.worker === worker);
}

function detectForkTurns(events) {
  for (const event of events) {
    if (event?.type !== "session_meta") continue;
    const candidates = [
      event?.payload?.fork_turns,
      event?.payload?.source?.fork_turns,
      event?.payload?.metadata?.fork_turns
    ];
    const found = candidates.find((value) => value !== undefined);
    if (found !== undefined) return found;
  }
  return null;
}

export function auditRolloutEvents(events, options = {}) {
  assertFloor(Array.isArray(events), "AF_USAGE_MALFORMED", "Rollout events must be an array");
  let boundaryIndex = -1;
  if (options.after) {
    boundaryIndex = events.findIndex((event) => typeof event?.timestamp === "string" && event.timestamp >= options.after);
    if (boundaryIndex >= 0) boundaryIndex -= 1;
  } else {
    boundaryIndex = events.findIndex((event) => isBoundary(event, options.worker));
  }
  assertFloor(
    boundaryIndex >= 0,
    "AF_USAGE_BOUNDARY_MISSING",
    "A worker boundary is required; refusing to attribute the entire inherited rollout"
  );

  let baseline = null;
  for (let index = 0; index <= boundaryIndex; index += 1) {
    const value = totalTokenValue(events[index]);
    if (value !== null) baseline = value;
  }

  const usageRecords = [];
  const fingerprints = new Set();
  let duplicates = 0;
  let rawCumulative = baseline;
  for (let index = boundaryIndex + 1; index < events.length; index += 1) {
    const event = events[index];
    const rawLast = event?.payload?.info?.last_token_usage;
    const cumulative = totalTokenValue(event);
    if (cumulative !== null && (rawCumulative === null || cumulative > rawCumulative)) {
      rawCumulative = cumulative;
    }
    if (!rawLast) continue;
    const fingerprint = sha256(
      canonicalJson({ timestamp: event.timestamp ?? null, last: rawLast, cumulative })
    );
    if (fingerprints.has(fingerprint)) {
      duplicates += 1;
      continue;
    }
    fingerprints.add(fingerprint);
    usageRecords.push(normalizeUsage(rawLast, `last_token_usage[${usageRecords.length}]`));
  }
  assertFloor(usageRecords.length > 0, "AF_USAGE_MISSING", "No request-local last_token_usage records were found after the boundary");
  const total = sumUsage(usageRecords);
  const cumulativeDelta = baseline === null || rawCumulative === null ? null : rawCumulative - baseline;
  const consistent = cumulativeDelta === null ? null : cumulativeDelta === total.total_tokens;
  const forkTurns = detectForkTurns(events);
  const fullHistory = forkTurns === "all";

  return {
    source: "codex-rollout-token-count",
    context_mode: fullHistory ? "full_history" : "unknown",
    fork_turns: forkTurns,
    full_history_detected: fullHistory,
    boundary_index: boundaryIndex,
    model_calls: usageRecords.length,
    input_tokens: total.input_tokens,
    cached_input_tokens: total.cached_input_tokens,
    fresh_input_tokens: total.fresh_input_tokens,
    output_tokens: total.output_tokens,
    reasoning_output_tokens: total.reasoning_output_tokens,
    incremental_tokens: total.total_tokens,
    baseline_cumulative_tokens: baseline,
    raw_cumulative_tokens: rawCumulative,
    cumulative_delta_tokens: cumulativeDelta,
    cumulative_delta_matches_incremental: consistent,
    naive_overstatement_tokens:
      rawCumulative === null ? null : rawCumulative - total.total_tokens,
    naive_overstatement_factor:
      rawCumulative === null ? null : Number((rawCumulative / total.total_tokens).toFixed(3)),
    accounting_status: consistent === false ? "CUMULATIVE_MISMATCH" : "INCREMENTAL_VERIFIED",
    duplicate_usage_events: duplicates
  };
}

export async function auditTraceFile(tracePath, options = {}) {
  let text;
  try {
    text = await readFile(tracePath, "utf8");
  } catch (error) {
    throw new AgentFloorError("AF_FILE_READ_FAILED", `Cannot read trace ${tracePath}`, { cause: error.message }, 1);
  }
  const events = parseJsonLines(text, tracePath);
  const kind = options.kind ?? inferTraceKind(events);
  if (kind === "codex") return auditCodexEvents(events, options);
  if (kind === "rollout") return auditRolloutEvents(events, options);
  throw new AgentFloorError("AF_TRACE_KIND_INVALID", `Unsupported trace kind: ${kind}`);
}

export function inferTraceKind(events) {
  if (events.some((event) => event?.type === "session_meta" || event?.type === "event_msg" || event?.type === "agent_floor.boundary")) {
    return "rollout";
  }
  if (events.some((event) => event?.type === "thread.started" || event?.type === "turn.completed")) {
    return "codex";
  }
  throw new AgentFloorError("AF_TRACE_KIND_UNKNOWN", "Trace does not contain recognized Codex events");
}
