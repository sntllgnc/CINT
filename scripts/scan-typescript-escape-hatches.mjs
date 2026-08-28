import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const findings = [];
const prohibited = Object.freeze([
  ["EXPLICIT_ANY", /\bany\b/gu],
  ["TYPE_IGNORE", /@ts-ignore\b/gu],
  ["TYPE_NOCHECK", /@ts-nocheck\b/gu],
  ["TYPE_EXPECT_ERROR_IN_PRODUCTION", /@ts-expect-error\b/gu],
  ["DOUBLE_ASSERTION", /\bas\s+(?:unknown|never)\s+as\b/gu],
  ["NON_NULL_ASSERTION", /(?:[A-Za-z0-9_$)\]])!(?=[.\[();,?:])/gu],
  ["DEFINITE_ASSIGNMENT_ASSERTION", /\b[A-Za-z_$][A-Za-z0-9_$]*!\s*:/gu]
]);

async function collect(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) files.push(...await collect(url));
    if (entry.isFile() && entry.name.endsWith(".ts")) files.push(url);
  }
  return files;
}

const sourceFiles = await collect(new URL("src/cint/", root));
const binSource = new URL("bin/cint.ts", root);
if (await readFile(binSource, "utf8").then(() => true, () => false)) sourceFiles.push(binSource);

for (const url of sourceFiles) {
  const text = await readFile(url, "utf8");
  const relative = path.relative(rootPath, fileURLToPath(url)).split(path.sep).join("/");
  for (const [code, expression] of prohibited) {
    for (const match of text.matchAll(expression)) {
      const prefix = text.slice(0, match.index);
      const line = prefix.split("\n").length;
      const column = match.index - prefix.lastIndexOf("\n");
      findings.push({ file: relative, code, line, column });
    }
  }
}

const result = {
  gate: "CINT-R1-TYPESCRIPT-ESCAPE-HATCH-SCAN",
  verdict: findings.length === 0 ? "PASS" : "FAIL",
  files_scanned: sourceFiles.length,
  findings
};
console.log(JSON.stringify(result, null, 2));
if (findings.length > 0) process.exitCode = 1;
