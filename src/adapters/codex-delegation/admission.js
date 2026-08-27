import { readFile } from "node:fs/promises";
import { resolveInside, normalizeLine, sha256 } from "../../util.js";

function rejection(code, message, details = undefined) {
  return { code, message, ...(details === undefined ? {} : { details }) };
}

function validateOutputShape(output) {
  const reasons = [];
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return [rejection("AF_OUTPUT_INVALID", "Worker output must be an object")];
  }
  if (typeof output.finding_code !== "string" || !/^[A-Z][A-Z0-9_]{1,79}$/.test(output.finding_code)) {
    reasons.push(rejection("AF_OUTPUT_INVALID", "finding_code must be an uppercase machine identifier"));
  }
  if (!["FOUND", "NO_FINDING", "BLOCKED"].includes(output.status)) {
    reasons.push(rejection("AF_OUTPUT_INVALID", "status must be FOUND, NO_FINDING, or BLOCKED"));
  }
  if (typeof output.finding !== "string" || output.finding.trim().length === 0) {
    reasons.push(rejection("AF_OUTPUT_INVALID", "finding must be a non-empty string"));
  }
  if (typeof output.summary !== "string" || output.summary.trim().length === 0) {
    reasons.push(rejection("AF_OUTPUT_INVALID", "summary must be a non-empty string"));
  }
  if (!Array.isArray(output.evidence)) {
    reasons.push(rejection("AF_OUTPUT_INVALID", "evidence must be an array"));
  }
  if (!["ADMIT", "REJECT"].includes(output.recommendation)) {
    reasons.push(rejection("AF_OUTPUT_INVALID", "recommendation must be ADMIT or REJECT"));
  }
  if (output.status === "FOUND" && Array.isArray(output.evidence) && output.evidence.length === 0) {
    reasons.push(rejection("AF_EVIDENCE_MISSING", "FOUND results require at least one evidence reference"));
  }
  return reasons;
}

async function verifyEvidence(spec, evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw rejection("AF_EVIDENCE_INVALID", "Evidence entry must be an object");
  }
  if (!spec.worker.allowed_paths.includes(evidence.path)) {
    throw rejection("AF_EVIDENCE_OUTSIDE_AUTHORITY", `Evidence path was not granted to the worker: ${evidence.path}`);
  }
  if (!Number.isSafeInteger(evidence.line) || evidence.line < 1) {
    throw rejection("AF_EVIDENCE_LINE_INVALID", "Evidence line must be a positive integer", { line: evidence.line });
  }
  if (typeof evidence.claim !== "string" || evidence.claim.trim().length === 0) {
    throw rejection("AF_EVIDENCE_CLAIM_INVALID", "Evidence claim must be a non-empty string");
  }
  if (typeof evidence.excerpt !== "string" || normalizeLine(evidence.excerpt).length < 4) {
    throw rejection("AF_EVIDENCE_EXCERPT_INVALID", "Evidence excerpt must contain at least four normalized characters");
  }
  let resolved;
  try {
    resolved = await resolveInside(spec.repository_boundary, evidence.path);
  } catch (error) {
    throw rejection(error.code ?? "AF_EVIDENCE_FILE_MISSING", error.message, error.details);
  }
  const text = await readFile(resolved.absolute, "utf8");
  const lines = text.split(/\r?\n/);
  if (evidence.line > lines.length) {
    throw rejection("AF_EVIDENCE_LINE_MISSING", `Evidence line ${evidence.line} does not exist in ${resolved.relative}`, { lineCount: lines.length });
  }
  const actual = lines[evidence.line - 1];
  const normalizedActual = normalizeLine(actual);
  const normalizedExcerpt = normalizeLine(evidence.excerpt);
  if (!normalizedActual.includes(normalizedExcerpt)) {
    throw rejection(
      "AF_EVIDENCE_EXCERPT_MISMATCH",
      `Evidence excerpt does not match ${resolved.relative}:${evidence.line}`,
      { expectedExcerpt: normalizedExcerpt, actualLine: normalizedActual }
    );
  }
  return {
    reference: `${resolved.relative}:${evidence.line}`,
    path: resolved.relative,
    line: evidence.line,
    claim: evidence.claim.trim(),
    excerpt: normalizedExcerpt,
    evidence_sha256: sha256(`${resolved.relative}:${evidence.line}:${normalizedActual}`)
  };
}

export async function admitWorkerResult({ spec, packetRecord, audit, output, runtime = {} }) {
  const reasons = validateOutputShape(output);
  const evidenceRecords = [];
  if (output && typeof output === "object") {
    if (!spec.admission.allowed_statuses.includes(output.status)) {
      reasons.push(
        rejection("AF_ADMISSION_STATUS_FORBIDDEN", `Worker status is outside the parent admission policy: ${output.status}`)
      );
    }
    if (!spec.admission.allowed_finding_codes.includes(output.finding_code)) {
      reasons.push(
        rejection("AF_FINDING_CODE_FORBIDDEN", `Finding code is outside the parent admission policy: ${output.finding_code}`)
      );
    }
    const evidenceClaims = Array.isArray(output.evidence)
      ? output.evidence.map((item) => item?.claim ?? "").join(" ")
      : "";
    const semanticText = normalizeLine(`${output.finding ?? ""} ${output.summary ?? ""} ${evidenceClaims}`).toLowerCase();
    for (const term of spec.admission.required_output_terms) {
      if (!semanticText.includes(normalizeLine(term).toLowerCase())) {
        reasons.push(rejection("AF_REQUIRED_TERM_MISSING", `Required admission term is absent: ${term}`));
      }
    }
    for (const term of spec.admission.forbidden_output_terms) {
      if (semanticText.includes(normalizeLine(term).toLowerCase())) {
        reasons.push(rejection("AF_FORBIDDEN_TERM_PRESENT", `Forbidden admission term is present: ${term}`));
      }
    }
    if (Array.isArray(output.evidence) && output.evidence.length < spec.admission.minimum_evidence) {
      reasons.push(
        rejection("AF_EVIDENCE_MINIMUM", "Worker supplied fewer evidence items than the parent admission policy requires", {
          actual: output.evidence.length,
          minimum: spec.admission.minimum_evidence
        })
      );
    }
  }

  for (const source of packetRecord?.packet?.authority?.source_manifest ?? []) {
    try {
      const resolved = await resolveInside(spec.repository_boundary, source.path);
      const bytes = await readFile(resolved.absolute);
      const currentHash = sha256(bytes);
      if (bytes.byteLength !== source.bytes || currentHash !== source.sha256) {
        reasons.push(
          rejection("AF_SOURCE_CHANGED", `Authority source changed after packet creation: ${source.path}`, {
            packet_sha256: source.sha256,
            current_sha256: currentHash,
            packet_bytes: source.bytes,
            current_bytes: bytes.byteLength
          })
        );
      }
    } catch (error) {
      reasons.push(rejection(error.code ?? "AF_SOURCE_CHANGED", error.message, error.details));
    }
  }

  if (runtime.exitCode !== undefined && runtime.exitCode !== 0) {
    reasons.push(rejection("AF_CHILD_EXIT_NONZERO", `Child process exited with code ${runtime.exitCode}`));
  }
  for (const violation of runtime.violations ?? []) {
    reasons.push(rejection(violation.code, violation.message, violation.details));
  }
  if (!audit) {
    reasons.push(rejection("AF_USAGE_MISSING", "Request-local usage audit is missing"));
  } else {
    if (audit.context_mode !== "clean" || audit.full_history_detected) {
      reasons.push(rejection("AF_CONTEXT_NOT_CLEAN", "A full-history or non-clean run cannot be admitted"));
    }
    if (audit.incremental_tokens > spec.delegation.max_incremental_tokens) {
      reasons.push(
        rejection("AF_TOKEN_LIMIT_EXCEEDED", "Incremental token usage exceeded the worker budget", {
          actual: audit.incremental_tokens,
          limit: spec.delegation.max_incremental_tokens
        })
      );
    }
  }
  if (runtime.outputBytes !== undefined && runtime.outputBytes > spec.delegation.max_output_bytes) {
    reasons.push(
      rejection("AF_OUTPUT_LIMIT_EXCEEDED", "Worker output exceeded the byte limit", {
        actual: runtime.outputBytes,
        limit: spec.delegation.max_output_bytes
      })
    );
  }
  if (output?.status === "BLOCKED") {
    reasons.push(rejection("AF_WORKER_BLOCKED", "Blocked worker results are not admissible"));
  }
  if (Array.isArray(output?.evidence)) {
    for (const evidence of output.evidence) {
      try {
        evidenceRecords.push(await verifyEvidence(spec, evidence));
      } catch (reason) {
        reasons.push(reason?.code ? reason : rejection("AF_EVIDENCE_INVALID", String(reason)));
      }
    }
  }

  const result = reasons.length === 0 ? "ADMITTED" : "REJECTED";
  return {
    protocol: "agent-floor/admission/1",
    worker: spec.worker.id,
    parent: spec.root_task_id,
    context_mode: audit?.context_mode ?? "unknown",
    packet_sha256: packetRecord.packet_sha256,
    model: spec.delegation.model,
    reasoning_effort: spec.delegation.reasoning_effort,
    model_calls: audit?.model_calls ?? 0,
    incremental_tokens: audit?.incremental_tokens ?? null,
    cached_input_tokens: audit?.cached_input_tokens ?? null,
    fresh_input_tokens: audit?.fresh_input_tokens ?? null,
    output_tokens: audit?.output_tokens ?? null,
    result,
    finding: output?.finding ?? null,
    finding_code: output?.finding_code ?? null,
    target_recommendation: output?.recommendation ?? null,
    evidence: evidenceRecords.map((record) => record.reference),
    evidence_records: evidenceRecords,
    rejection_reasons: reasons
  };
}
