import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const suite = process.argv[2];
assert.ok(["all", "cint", "legacy"].includes(suite), "suite must be all, cint, or legacy");

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const root = process.argv[3] === undefined ? sourceRoot : path.resolve(sourceRoot, process.argv[3]);
const tests = (await readdir(path.join(root, "tests")))
  .filter((name) => name.endsWith(".test.js"))
  .filter((name) => {
    if (suite === "all") return true;
    return suite === "cint" ? name.startsWith("cint-") : !name.startsWith("cint-");
  })
  .sort()
  .map((name) => path.join("tests", name));

assert.ok(tests.length > 0, `no ${suite} tests found`);
const result = spawnSync(process.execPath, ["--test", ...tests], {
  cwd: root,
  stdio: "inherit"
});
assert.equal(result.status, 0, `${suite} test suite failed`);
