import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEMO_SPEC, PROJECT_ROOT } from "../src/demo.js";
import { loadTaskSpec } from "../src/policy.js";
import {
  buildChildProcessEnv,
  buildCodexArgs,
  ExecutionGuard,
  runGovernedChild
} from "../src/runner.js";

test("child process environment is allowlisted and shell secret patterns are excluded", () => {
  const env = buildChildProcessEnv({
    HOME: "/safe/home",
    PATH: "/safe/bin",
    OPENAI_API_KEY: "must-not-leak",
    PRIVATE_TOKEN: "must-not-leak",
    AGENT_FLOOR_CODEX_ENV_ALLOWLIST: "HTTPS_PROXY",
    HTTPS_PROXY: "http://proxy.invalid"
  });
  assert.equal(env.HOME, "/safe/home");
  assert.equal(env.PATH, "/safe/bin");
  assert.equal(env.HTTPS_PROXY, "http://proxy.invalid");
  assert.equal(env.NO_COLOR, "1");
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.PRIVATE_TOKEN, undefined);

  const args = buildCodexArgs(
    { delegation: { model: "gpt-5.6-terra", reasoning_effort: "medium" } },
    { workspace: "/tmp/workspace", instructions: "/tmp/instructions", output: "/tmp/output" }
  );
  assert(args.includes("shell_environment_policy.inherit=\"core\""));
  assert(args.some((value) => value.includes("*SECRET*")));
});

test("one command creates and audits a clean bounded child process", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "agent-floor-test-"));
  const mock = path.join(PROJECT_ROOT, "fixtures", "sanitized-af-g0", "mock-codex.mjs");
  await chmod(mock, 0o755);
  try {
    const { spec } = await loadTaskSpec(DEMO_SPEC);
    const record = await runGovernedChild({
      spec,
      outputDir: temporary,
      codexBinary: process.execPath,
      codexArgs: [mock]
    });
    assert.equal(record.context_enforcement.process_boundary, true);
    assert.equal(record.context_enforcement.inherited_turns, 0);
    assert.equal(record.context_enforcement.multi_agent_tools, "disabled");
    assert.equal(record.context_enforcement.child_spawn_depth, 0);
    assert.equal(record.audit.incremental_tokens, 1100);
    assert.equal(record.admission.result, "ADMITTED");
    const saved = JSON.parse(await readFile(path.join(temporary, "run.json"), "utf8"));
    assert.equal(saved.admission.result, "ADMITTED");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("execution guard trips hard cycle and output limits", () => {
  const guard = new ExecutionGuard({ max_cycles: 2, max_output_bytes: 8 });
  guard.observe({ type: "turn.started" });
  guard.observe({ type: "item.started", item: { id: "a", type: "command_execution" } });
  guard.observe({ type: "item.started", item: { id: "b", type: "command_execution" } });
  guard.observe({ type: "item.completed", item: { id: "m", type: "agent_message", text: "123456789" } });
  assert(guard.violations.some((item) => item.code === "AF_CYCLE_LIMIT_EXCEEDED"));
  assert(guard.violations.some((item) => item.code === "AF_OUTPUT_LIMIT_EXCEEDED"));
});
