import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const [entry, args, label] of [
  [new URL("./build.mjs", import.meta.url), [], "CINT build"],
  [new URL("../dist/bin/cint.js", import.meta.url), process.argv.slice(2), "CINT CLI"]
]) {
  const result = spawnSync(process.execPath, [fileURLToPath(entry), ...args], {
    cwd: root,
    stdio: "inherit"
  });
  assert.equal(result.status, 0, `${label} failed`);
}
