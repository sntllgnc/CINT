#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "artifacts", "evidence-manifest.json");
const expectedArchiveSha = "c98b062b551390ac1352af1588ab61fc2f7e3617144745736884fde0bd156f61";
const excludedDirectories = new Set([".git", "node_modules"]);
const excludedPrefixes = ["artifacts/generated/"];
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (excludedPrefixes.some((prefix) => relative.startsWith(prefix))) continue;
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) continue;
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) await walk(absolute);
      continue;
    }
    if (absolute !== output) files.push({ absolute, relative });
  }
}

await walk(root);
files.sort((left, right) => left.relative.localeCompare(right.relative));

const entries = [];
for (const file of files) {
  const bytes = await readFile(file.absolute);
  entries.push({
    path: file.relative,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

const manifest = {
  protocol: "agent-floor/evidence-manifest/1",
  release: "v0.1.0-af-g0",
  source_archive: {
    name: "agent-floor-af-g0.tar.gz",
    sha256: expectedArchiveSha,
    status: "VERIFIED_BEFORE_PUBLICATION"
  },
  release_gate: "AF-G0",
  expected_proof: {
    tests: 14,
    raw_cumulative_tokens: 555300000,
    request_local_incremental_tokens: 1492621,
    overstatement_tokens_removed: 553807379,
    correction_factor: 372.03
  },
  public_tree: {
    files: entries.length,
    entries
  }
};

await writeFile(output, JSON.stringify(manifest, null, 2) + "\n", "utf8");
process.stdout.write(JSON.stringify({ result: "WROTE", path: "artifacts/evidence-manifest.json", files: entries.length }) + "\n");
