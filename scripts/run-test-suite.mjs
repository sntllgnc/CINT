import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const suite = process.argv[2];
assert.ok(["all", "cint", "legacy"].includes(suite), "suite must be all, cint, or legacy");

const root = fileURLToPath(new URL("../", import.meta.url));
const tests = (await readdir(new URL("../tests/", import.meta.url)))
  .filter((name) => name.endsWith(".test.js"))
  .filter((name) => {
    if (suite === "all") return true;
    return suite === "cint" ? name.startsWith("cint-") : !name.startsWith("cint-");
  })
  .sort()
  .map((name) => `tests/${name}`);

assert.ok(tests.length > 0, `no ${suite} tests found`);
const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  stdio: "inherit"
});
assert.equal(result.status, 0, `${suite} test suite failed`);
