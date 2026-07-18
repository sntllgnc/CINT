import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runDemo } from "../src/demo.js";

test("AF-G0 judge demo passes without a private repository or model call", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "agent-floor-demo-test-"));
  try {
    const record = await runDemo({ outputDir: temporary });
    assert.equal(record.verdict, "PASS");
    assert.equal(record.historical_regression.raw_cumulative_tokens, 555_300_000);
    assert.equal(record.incremental_tokens, 1_492_621);
    assert.equal(record.result, "ADMITTED");
    assert.equal(record.semantic_negative_control.result, "REJECTED");
    assert(record.semantic_negative_control.rejection_codes.includes("AF_FORBIDDEN_TERM_PRESENT"));
    const saved = JSON.parse(await readFile(path.join(temporary, "af-g0.json"), "utf8"));
    assert.equal(saved.verdict, "PASS");
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
