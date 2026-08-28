#!/usr/bin/env node
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".test-dist", "dist", "node_modules"]);
const ignoredPrefixes = ["artifacts/generated/"];
const allowedDotfiles = new Set([".gitignore", ".node-version", ".npmrc", ".nvmrc"]);
const allowedHiddenDirectories = new Set([".github"]);
const privateNames = ["S" + "I1", "Y" + "I1", "S" + "I6", "F" + "YRE"];
const authorizedPublicNames = [new RegExp("\\b" + "SI1(?:[ -]CINT)" + "\\b", "gi")];
const findings = [];
const files = [];
const excludedMetadata = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).split(path.sep).join("/");
    if (entry.name === ".git") continue;
    if (ignoredPrefixes.some((prefix) => relative.startsWith(prefix))) continue;
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) {
      excludedMetadata.push(relative);
      continue;
    }
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      if (entry.name.startsWith(".") && !allowedHiddenDirectories.has(relative)) {
        findings.push({ code: "HIDDEN_DIRECTORY", path: relative });
      }
      await walk(absolute);
      continue;
    }
    const metadata = await lstat(absolute).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (metadata === null) continue;
    if (!metadata.isFile()) {
      findings.push({ code: "NON_REGULAR_FILE", path: relative });
      continue;
    }
    if (entry.name.startsWith(".") && !allowedDotfiles.has(relative)) {
      findings.push({ code: "HIDDEN_FILE", path: relative });
    }
    if (entry.name.endsWith(".log")) findings.push({ code: "RAW_LOG_FILE", path: relative });
    if (
      entry.name.endsWith(".jsonl") &&
      !relative.startsWith("fixtures/sanitized-af-g0/traces/")
    ) {
      findings.push({ code: "UNSANCTIONED_JSONL", path: relative });
    }
    files.push({ absolute, relative });
  }
}

await walk(root);

const contentRules = [
  ["ABSOLUTE_MACOS_USER_PATH", new RegExp("/" + "Users" + "/")],
  ["ABSOLUTE_CODESPACE_PATH", new RegExp("/" + "workspaces" + "/")],
  ["EMAIL_ADDRESS", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["OPENAI_SECRET", new RegExp("\\b" + "sk-" + "[A-Za-z0-9_-]{20,}\\b")],
  ["GITHUB_SECRET", new RegExp("\\b(?:" + "ghp_|gho_|ghu_|ghs_|ghr_|github_pat_" + ")[A-Za-z0-9_]{16,}\\b")],
  ["AWS_ACCESS_KEY", /\bAKIA[0-9A-Z]{16}\b/],
  ["SESSION_UUID", /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i]
];

for (const file of files) {
  const content = await readFile(file.absolute, "utf8").catch(() => null);
  if (content === null) {
    findings.push({ code: "NON_TEXT_FILE", path: file.relative });
    continue;
  }
  if (file.relative !== "scripts/publication-audit.mjs") {
    for (const [code, expression] of contentRules) {
      if (expression.test(content)) findings.push({ code, path: file.relative });
    }
    const privateNameSurface = authorizedPublicNames.reduce(
      (value, expression) => value.replace(expression, "CINT"),
      content
    );
    for (const name of privateNames) {
      if (new RegExp(`\\b${name}\\b`, "i").test(privateNameSurface)) {
        findings.push({ code: "PRIVATE_PROJECT_NAME", path: file.relative });
      }
    }
  }
}

const result = {
  gate: "CINT-PUBLICATION-AUDIT",
  verdict: findings.length === 0 ? "PASS" : "FAIL",
  files_scanned: files.length,
  excluded_metadata_files: excludedMetadata.length,
  checks: [
    "regular files only",
    "Finder metadata excluded from the public object",
    "no raw logs outside the sanitized fixture",
    "no local absolute paths",
    "no email addresses",
    "no common credential formats",
    "no session UUIDs",
    "no private project names"
  ],
  findings
};

process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (findings.length > 0) process.exitCode = 1;
