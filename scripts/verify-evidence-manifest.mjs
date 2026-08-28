#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "artifacts", "evidence-manifest.json");
const release = "v0.1.0-af-g0";
const releaseCommit = "d57a80404e04d2c376cba9cc4b3fc06a5d8c8c49";
const resolvedRelease = spawnSync("git", ["rev-parse", `${release}^{commit}`], {
  cwd: root,
  encoding: "utf8"
});
const immutableReleaseAvailable =
  resolvedRelease.status === 0 && resolvedRelease.stdout.trim() === releaseCommit;

function readImmutableRelease(relativePath) {
  const result = spawnSync("git", ["show", `${release}:${relativePath}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 16 * 1024 * 1024
  });
  return result.status === 0 ? result.stdout : null;
}

const manifestBytes = immutableReleaseAvailable
  ? readImmutableRelease("artifacts/evidence-manifest.json")
  : await readFile(manifestPath).catch(() => null);
const manifest = manifestBytes === null ? null : JSON.parse(manifestBytes.toString("utf8"));
const failures = [];
if (manifest === null) failures.push({ path: "artifacts/evidence-manifest.json", reason: "MISSING" });

for (const entry of manifest?.public_tree?.entries ?? []) {
  const absolute = path.resolve(root, entry.path);
  if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
    failures.push({ path: entry.path, reason: "OUTSIDE_RELEASE_ROOT" });
    continue;
  }
  const bytes = immutableReleaseAvailable
    ? readImmutableRelease(entry.path)
    : await readFile(absolute).catch(() => null);
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
  release: manifest?.release ?? release,
  release_commit: releaseCommit,
  verification_source: immutableReleaseAvailable ? "immutable-git-release" : "current-release-tree",
  entries_verified: manifest?.public_tree?.entries?.length ?? 0,
  source_archive_status: manifest?.source_archive?.status ?? "UNAVAILABLE",
  failures
};

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (failures.length > 0) process.exitCode = 1;
