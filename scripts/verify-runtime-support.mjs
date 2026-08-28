import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const expectedEngine = "^22.0.0 || ^24.0.0 || ^26.0.0";
const supportedMajors = Object.freeze([22, 24, 26]);
const aggregateChecks = Object.freeze([
  "CINT-R0 remote verification",
  "CINT-R1 TypeScript verification"
]);

async function text(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

function acceptsMajor(major) {
  return supportedMajors.includes(major);
}

function workflowJobs(workflow) {
  const jobs = [];
  let inJobs = false;
  let current = null;
  for (const line of workflow.split("\n")) {
    if (line === "jobs:") {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    const job = /^  ([a-z0-9-]+):$/u.exec(line);
    if (job) {
      current = { id: job[1], lines: [] };
      jobs.push(current);
      continue;
    }
    if (/^\S/u.test(line)) break;
    if (current !== null) current.lines.push(line);
  }
  return jobs;
}

function jobName(job) {
  const names = job.lines
    .map((line) => /^    name: (.+)$/u.exec(line)?.[1])
    .filter((value) => value !== undefined);
  assert.equal(names.length, 1, `workflow job ${job.id} must have exactly one name`);
  return names[0];
}

function jobNeeds(job) {
  const needs = [];
  const start = job.lines.indexOf("    needs:");
  if (start === -1) return needs;
  for (const line of job.lines.slice(start + 1)) {
    const dependency = /^      - ([a-z0-9-]+)$/u.exec(line)?.[1];
    if (dependency === undefined) break;
    needs.push(dependency);
  }
  return needs;
}

function verifyWorkflowStructure(workflowBytes, lineEnding) {
  const workflow = workflowBytes.replace(/\r\n?/gu, "\n");
  const matrixBlock = workflow.match(/\n\s{8}node:\n((?:\s{10}- "\d+"\n)+)/u)?.[1];
  assert.ok(matrixBlock, `${lineEnding} Node verification matrix is unavailable`);
  const matrixMajors = [...matrixBlock.matchAll(/- "(\d+)"/gu)].map((match) => Number(match[1]));
  assert.deepEqual(matrixMajors, supportedMajors, `${lineEnding} CI must test exactly Node 22, 24, and 26`);

  const jobs = workflowJobs(workflow).map((job) => ({
    id: job.id,
    name: jobName(job),
    needs: jobNeeds(job)
  }));
  for (const aggregate of aggregateChecks) {
    const matches = jobs.filter((job) => job.name === aggregate);
    assert.equal(matches.length, 1, `${lineEnding} aggregate name must occur exactly once: ${aggregate}`);
    assert.deepEqual(
      matches[0].needs,
      ["verification-matrix"],
      `${lineEnding} aggregate must depend solely on verification-matrix: ${aggregate}`
    );
  }
  assert.deepEqual(
    jobs
      .filter((job) => job.needs.includes("verification-matrix"))
      .map((job) => job.name)
      .sort(),
    [...aggregateChecks].sort(),
    `${lineEnding} only the two exact aggregate checks may depend on verification-matrix`
  );
  return matrixMajors;
}

const packageJson = JSON.parse(await text("package.json"));
const packageLock = JSON.parse(await text("package-lock.json"));
const nvmrc = (await text(".nvmrc")).trim();
const nodeVersion = (await text(".node-version")).trim();
const npmrc = (await text(".npmrc")).trim();
const workflowBytes = await text(".github/workflows/cint-r0-verification.yml");

assert.equal(packageJson.engines?.node, expectedEngine, "package engine policy drifted");
assert.equal(packageLock.packages?.[""]?.engines?.node, expectedEngine, "lockfile engine policy drifted");
assert.equal(nvmrc, "24", ".nvmrc must select Node 24");
assert.equal(nodeVersion, "24", ".node-version must select Node 24");
assert.equal(npmrc, "engine-strict=true", ".npmrc must enforce engine compatibility");

const lfWorkflow = workflowBytes.replace(/\r\n?/gu, "\n");
const crlfWorkflow = lfWorkflow.replace(/\n/gu, "\r\n");
const matrixMajors = verifyWorkflowStructure(lfWorkflow, "LF");
assert.deepEqual(
  verifyWorkflowStructure(crlfWorkflow, "CRLF"),
  matrixMajors,
  "LF and CRLF workflow bytes must produce identical verification results"
);
assert.throws(
  () => verifyWorkflowStructure(
    lfWorkflow.replace(
      "    name: CINT-R0 remote verification\n",
      "    name: CINT-R0 remote verification weakened\n"
    ),
    "RENAMED"
  ),
  /aggregate name must occur exactly once/u,
  "aggregate name suffixes must not satisfy exact-name enforcement"
);
assert.throws(
  () => verifyWorkflowStructure(
    lfWorkflow.replace(
      "    name: CINT-R1 TypeScript verification\n    if: ${{ always() }}\n    needs:\n      - verification-matrix\n",
      "    name: CINT-R1 TypeScript verification\n    if: ${{ always() }}\n    needs:\n      - unrelated-check\n"
    ),
    "UNBOUND"
  ),
  /aggregate must depend solely on verification-matrix/u,
  "aggregate names must remain bound to their own matrix dependency"
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
  aggregate_checks: aggregateChecks,
  line_ending_regressions: {
    LF: "PASS",
    CRLF: "PASS"
  },
  aggregate_binding_negative_regressions: "PASS",
  samples
}, null, 2));
