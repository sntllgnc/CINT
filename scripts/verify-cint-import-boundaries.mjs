import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "src", "cint");
const allowed = new Map([
  ["src/cint/adapters/codex/legacy-adapter-boundary.ts", new Set(["../../../adapters/codex-delegation/index.js"])],
  ["src/cint/cli.ts", new Set(["../cli.js"])]
]);
const findings = [];
let filesScanned = 0;

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    filesScanned += 1;
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    const text = await readFile(absolute, "utf8");
    for (const match of text.matchAll(/(?:from\s+|import\s*\()["']([^"']+)["']/gu)) {
      const specifier = match[1];
      if (!specifier) continue;
      const crossesLegacy = specifier.includes("/adapters/") || specifier === "../cli.js" || specifier.endsWith("/util.js");
      if (!crossesLegacy) continue;
      if (!allowed.get(relative)?.has(specifier)) findings.push({ file: relative, specifier });
    }
  }
}

await walk(source);
assert.equal(findings.length, 0, JSON.stringify(findings));
console.log(JSON.stringify({
  gate: "CINT-R1-TYPED-LEGACY-IMPORT-BOUNDARY",
  verdict: "PASS",
  files_scanned: filesScanned,
  typed_adapter_boundary: "src/cint/adapters/codex/legacy-adapter-boundary.ts",
  lazy_legacy_cli_boundary: "src/cint/cli.ts",
  findings
}, null, 2));
