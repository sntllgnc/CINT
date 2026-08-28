import assert from "node:assert/strict";
import { readdir, readFile, rm } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
assert.equal(packageJson.name, "@sntllgnc/cint", "refusing to clean an unexpected package root");

for (const relativePath of ["dist/", ".test-dist/"]) {
  await rm(new URL(relativePath, root), { recursive: true, force: true });
}

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".tsbuildinfo")) {
    await rm(new URL(entry.name, root), { force: true });
  }
}

console.log(JSON.stringify({
  gate: "CINT-R1-CLEAN",
  verdict: "PASS",
  removed_roots: ["dist", ".test-dist"],
  removed_root_tsbuildinfo: true
}, null, 2));
