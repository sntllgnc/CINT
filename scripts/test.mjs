import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const suite = process.argv[2] ?? "all";
assert.ok(["all", "cint", "legacy"].includes(suite), "suite must be all, cint, or legacy");

const root = fileURLToPath(new URL("../", import.meta.url));
for (const [script, args, label] of [
  ["./build-test.mjs", [], "compiled test build"],
  ["./run-test-suite.mjs", [suite, ".test-dist"], `${suite} compiled tests`]
]) {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), ...args], {
    cwd: root,
    stdio: "inherit"
  });
  assert.equal(result.status, 0, `${label} failed`);
}
