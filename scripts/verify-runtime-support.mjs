import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const expectedEngine = "^22.0.0 || ^24.0.0 || ^26.0.0";
const supportedMajors = Object.freeze([22, 24, 26]);

async function text(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

function acceptsMajor(major) {
  return supportedMajors.includes(major);
}

const packageJson = JSON.parse(await text("package.json"));
const packageLock = JSON.parse(await text("package-lock.json"));
const nvmrc = (await text(".nvmrc")).trim();
const nodeVersion = (await text(".node-version")).trim();
const npmrc = (await text(".npmrc")).trim();
const workflow = await text(".github/workflows/cint-r0-verification.yml");

assert.equal(packageJson.engines?.node, expectedEngine, "package engine policy drifted");
assert.equal(packageLock.packages?.[""]?.engines?.node, expectedEngine, "lockfile engine policy drifted");
assert.equal(nvmrc, "24", ".nvmrc must select Node 24");
assert.equal(nodeVersion, "24", ".node-version must select Node 24");
assert.equal(npmrc, "engine-strict=true", ".npmrc must enforce engine compatibility");

const matrixBlock = workflow.match(/\n\s{8}node:\n((?:\s{10}- "\d+"\n)+)/u)?.[1];
assert.ok(matrixBlock, "Node verification matrix is unavailable");
const matrixMajors = [...matrixBlock.matchAll(/- "(\d+)"/gu)].map((match) => Number(match[1]));
assert.deepEqual(matrixMajors, supportedMajors, "CI must test exactly Node 22, 24, and 26");

for (const aggregate of ["CINT-R0 remote verification", "CINT-R1 TypeScript verification"]) {
  assert.ok(workflow.includes(`name: ${aggregate}`), `missing aggregate check: ${aggregate}`);
}
assert.equal(
  [...workflow.matchAll(/needs:\n\s+- verification-matrix/gu)].length,
  2,
  "both aggregate checks must depend on the same complete matrix"
);

const samples = Object.freeze({
  "20.0.0": acceptsMajor(20),
  "22.0.0": acceptsMajor(22),
  "24.0.0": acceptsMajor(24),
  "25.0.0": acceptsMajor(25),
  "26.0.0": acceptsMajor(26)
});
assert.deepEqual(samples, {
  "20.0.0": false,
  "22.0.0": true,
  "24.0.0": true,
  "25.0.0": false,
  "26.0.0": true
});

const currentMajor = Number(process.versions.node.split(".")[0]);
assert.ok(acceptsMajor(currentMajor), `current Node ${process.version} is outside the supported/tested majors`);

console.log(JSON.stringify({
  gate: "CINT-R1-RUNTIME-SUPPORT",
  verdict: "PASS",
  normative_major: 24,
  temporary_compatibility_major: 22,
  forward_compatibility_major: 26,
  retired_major: 20,
  engine: expectedEngine,
  current_runtime: process.version,
  matrix: matrixMajors,
  aggregate_checks: [
    "CINT-R0 remote verification",
    "CINT-R1 TypeScript verification"
  ],
  samples
}, null, 2));
