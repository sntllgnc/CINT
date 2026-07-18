import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DEMO_SPEC } from "../src/demo.js";
import {
  ALLOWED_REASONING_EFFORTS,
  loadTaskSpec,
  validateTaskSpec
} from "../src/policy.js";

const specDir = path.dirname(DEMO_SPEC);

async function rawSpec() {
  return JSON.parse(await readFile(DEMO_SPEC, "utf8"));
}

test("accepts the clean bounded demo task", async () => {
  const { spec } = await loadTaskSpec(DEMO_SPEC);
  assert.equal(spec.delegation.context_mode, "clean");
  assert.equal(spec.delegation.fork_turns, "none");
  assert.equal(spec.delegation.max_depth, 1);
});

test("mechanically rejects full-history inheritance", async () => {
  const raw = await rawSpec();
  raw.delegation.fork_turns = "all";
  await assert.rejects(
    validateTaskSpec(raw, { specDir }),
    (error) => error.code === "AF_CONTEXT_FULL_HISTORY_FORBIDDEN"
  );
});

test("supports every configured reasoning tier including xhigh, ultra, and max", async () => {
  for (const reasoning of ALLOWED_REASONING_EFFORTS) {
    const raw = await rawSpec();
    raw.delegation.reasoning_effort = reasoning;
    const spec = await validateTaskSpec(raw, { specDir });
    assert.equal(spec.delegation.reasoning_effort, reasoning);
  }
});

test("rejects excess depth, fan-out, cycles, output, and token budgets", async () => {
  const mutations = [
    ["max_depth", 2],
    ["max_concurrency", 3],
    ["max_cycles", 7],
    ["max_output_bytes", 32769],
    ["max_incremental_tokens", 2000001]
  ];
  for (const [field, value] of mutations) {
    const raw = await rawSpec();
    raw.delegation[field] = value;
    await assert.rejects(validateTaskSpec(raw, { specDir }), (error) => error.code === "AF_LIMIT_INVALID");
  }
});
