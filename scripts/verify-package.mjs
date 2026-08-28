import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(packageJson.private, true, "package must remain private");

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const packed = spawnSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
  cwd: root,
  encoding: "utf8"
});
assert.equal(packed.status, 0, packed.stderr || "npm pack dry run failed");
const report = JSON.parse(packed.stdout);
assert.ok(Array.isArray(report) && report.length === 1, "unexpected npm pack report");
const files = new Set(report[0].files.map((entry) => entry.path));

function targets(value) {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(targets);
  return [];
}

const declaredTargets = [
  ...targets(packageJson.exports),
  ...targets(packageJson.bin),
  ...targets(packageJson.types)
].map((target) => target.replace(/^\.\//u, ""));

for (const target of declaredTargets) {
  assert.ok(files.has(target), `declared package target is absent from dry run: ${target}`);
}

console.log(JSON.stringify({
  gate: "CINT-R1-PACKAGE-EXPORTS",
  verdict: "PASS",
  private: true,
  file_count: files.size,
  declared_targets: declaredTargets.sort()
}, null, 2));
