import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(packageJson.private, true, "package must remain private");

const build = spawnSync(process.execPath, [fileURLToPath(new URL("./build.mjs", import.meta.url))], {
  cwd: root,
  stdio: "inherit"
});
assert.equal(build.status, 0, "package verification build failed");

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

const declaredTargets = [...new Set([
  ...targets(packageJson.exports),
  ...targets(packageJson.bin),
  ...targets(packageJson.types)
].map((target) => target.replace(/^\.\//u, "")))];

for (const target of declaredTargets) {
  assert.ok(files.has(target), `declared package target is absent from dry run: ${target}`);
}

for (const subpath of [
  "@sntllgnc/cint",
  "@sntllgnc/cint/cli",
  "@sntllgnc/cint/adapters/synthetic-file-patch",
  "@sntllgnc/cint/adapters/codex-delegation"
]) {
  await import(subpath);
}

const declarationCheck = spawnSync(process.execPath, [
  fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)),
  "--noEmit",
  "--target", "ES2022",
  "--module", "NodeNext",
  "--moduleResolution", "NodeNext",
  "--types", "node",
  "--strict",
  "--skipLibCheck", "false",
  "tests/package-exports.consumer.ts"
], {
  cwd: root,
  encoding: "utf8"
});
assert.equal(declarationCheck.status, 0, declarationCheck.stdout + declarationCheck.stderr);

async function sourceMaps(directory) {
  const maps = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) maps.push(...await sourceMaps(absolute));
    if (entry.isFile() && entry.name.endsWith(".map")) maps.push(absolute);
  }
  return maps;
}

const maps = await sourceMaps(path.join(root, "dist"));
for (const map of maps) {
  const content = await readFile(map, "utf8");
  assert.doesNotMatch(content, /\/(?:Users|home|workspaces)\//u, `source map contains a private absolute path: ${map}`);
  assert.doesNotMatch(content, /[A-Za-z]:\\(?:Users|home|workspaces)\\/u, `source map contains a private absolute path: ${map}`);
}

console.log(JSON.stringify({
  gate: "CINT-R1-PACKAGE-EXPORTS",
  verdict: "PASS",
  private: true,
  file_count: files.size,
  declared_targets: declaredTargets.sort(),
  runtime_exports_resolved: 4,
  declaration_exports_resolved: 4,
  source_maps_checked: maps.length,
  private_absolute_paths: 0
}, null, 2));
