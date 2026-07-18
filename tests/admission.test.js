import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { admitWorkerResult } from "../src/admission.js";
import { auditTraceFile } from "../src/audit.js";
import { DEMO_SPEC, PROJECT_ROOT } from "../src/demo.js";
import { createChildPacket } from "../src/packet.js";
import { loadTaskSpec } from "../src/policy.js";

async function setup() {
  const { spec } = await loadTaskSpec(DEMO_SPEC);
  const packetRecord = await createChildPacket(spec);
  const audit = await auditTraceFile(
    path.join(PROJECT_ROOT, "fixtures", "sanitized-af-g0", "traces", "r1-clean-worker.jsonl"),
    { kind: "codex", contextMode: "clean" }
  );
  const output = JSON.parse(
    await readFile(
      path.join(PROJECT_ROOT, "fixtures", "sanitized-af-g0", "results", "r1-worker-output.json"),
      "utf8"
    )
  );
  return { spec, packetRecord, audit, output };
}

test("admits only verified in-boundary file-line evidence", async () => {
  const values = await setup();
  const admission = await admitWorkerResult({
    ...values,
    runtime: { exitCode: 0, outputBytes: 1000, violations: [] }
  });
  assert.equal(admission.result, "ADMITTED");
  assert.deepEqual(admission.evidence, ["contract.json:809", "negative-conformance-vectors.json:10"]);
  assert.match(admission.evidence_records[0].evidence_sha256, /^[a-f0-9]{64}$/);
});

test("rejects an excerpt that does not match the cited line", async () => {
  const values = await setup();
  values.output.evidence[0].excerpt = "fabricated authority rule";
  const admission = await admitWorkerResult({
    ...values,
    runtime: { exitCode: 0, outputBytes: 1000, violations: [] }
  });
  assert.equal(admission.result, "REJECTED");
  assert(admission.rejection_reasons.some((reason) => reason.code === "AF_EVIDENCE_EXCERPT_MISMATCH"));
});

test("rejects a path not granted in the child authority packet", async () => {
  const values = await setup();
  values.output.evidence[0].path = "../private-contract.json";
  const admission = await admitWorkerResult({
    ...values,
    runtime: { exitCode: 0, outputBytes: 1000, violations: [] }
  });
  assert.equal(admission.result, "REJECTED");
  assert(admission.rejection_reasons.some((reason) => reason.code === "AF_EVIDENCE_OUTSIDE_AUTHORITY"));
});

test("rejects a semantically contradictory conclusion even when every citation is real", async () => {
  const values = await setup();
  values.output = JSON.parse(
    await readFile(
      path.join(PROJECT_ROOT, "fixtures", "sanitized-af-g0", "results", "r1-contradictory-output.json"),
      "utf8"
    )
  );
  const admission = await admitWorkerResult({
    ...values,
    runtime: { exitCode: 0, outputBytes: 1000, violations: [] }
  });
  assert.equal(admission.result, "REJECTED");
  assert(admission.rejection_reasons.some((reason) => reason.code === "AF_FORBIDDEN_TERM_PRESENT"));
  assert(admission.rejection_reasons.some((reason) => reason.code === "AF_REQUIRED_TERM_MISSING"));
});
