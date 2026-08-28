import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function run(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    stdio: "inherit"
  });
  assert.equal(result.status, 0, `${label} failed`);
}

run([fileURLToPath(new URL("./clean.mjs", import.meta.url))], "clean");
run([
  fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
  "--project",
  "tsconfig.build.json"
], "TypeScript build");

console.log(JSON.stringify({
  gate: "CINT-R1-BUILD",
  verdict: "PASS",
  output: "dist"
}, null, 2));
