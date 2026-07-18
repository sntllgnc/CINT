#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "artifacts", "evidence-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const failures = [];

for (const entry of manifest.public_tree.entries) {
  const absolute = path.resolve(root, entry.path);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    failures.push({ path: entry.path, reason: "OUTSIDE_RELEASE_ROOT" });
    continue;
  }
  const bytes = await readFile(absolute).catch(() => null);
  if (bytes === null) {
    failures.push({ path: entry.path, reason: "MISSING" });
    continue;
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== entry.sha256 || bytes.length !== entry.bytes) {
    failures.push({ path: entry.path, reason: "CONTENT_MISMATCH" });
  }
}

const result = {
  gate: "AF-EVIDENCE-MANIFEST",
  verdict: failures.length === 0 ? "PASS" : "FAIL",
  release: manifest.release,
  entries_verified: manifest.public_tree.entries.length,
  source_archive_status: manifest.source_archive.status,
  failures
};

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (failures.length > 0) process.exitCode = 1;
