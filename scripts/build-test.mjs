import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

const build = spawnSync(process.execPath, [fileURLToPath(new URL("./build.mjs", import.meta.url))], {
  cwd: root,
  stdio: "inherit"
});
assert.equal(build.status, 0, "runtime build failed before test overlay");

const compileTests = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
  "--project",
  "tsconfig.cint-test-build.json"
], {
  cwd: root,
  stdio: "inherit"
});
assert.equal(compileTests.status, 0, "strict CINT test compilation failed before test overlay");

const testRoot = path.join(root, ".test-dist");
await mkdir(testRoot, { recursive: true });
for (const directory of ["src", "bin", "schemas", "fixtures", "examples", "tests"]) {
  await cp(path.join(root, directory === "src" || directory === "bin" || directory === "schemas" ? "dist" : "", directory), path.join(testRoot, directory), {
    recursive: true,
    force: true
  });
}

console.log(JSON.stringify({
  gate: "CINT-R1-TEST-BUILD",
  verdict: "PASS",
  output: ".test-dist",
  strict_cint_test_compilation: true
}, null, 2));
