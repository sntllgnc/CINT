import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { AgentFloorError, assertFloor } from "../../errors.js";
import { assertSafeRelativePath, isWithin } from "../../util.js";

export const FLOOR_LIMITS = Object.freeze({
  packetBytes: 8 * 1024,
  maxDepth: 1,
  maxConcurrency: 2,
  maxCycles: 6,
  maxRuntimeSeconds: 600,
  maxOutputBytes: 32 * 1024,
  maxIncrementalTokens: 2_000_000,
  maxAllowedPaths: 32,
  maxEvidenceRequirements: 8
});

export const ALLOWED_MODELS = Object.freeze([
  "gpt-5.6",
  "gpt-5.6-terra",
  "gpt-5.6-sol"
]);

export const ALLOWED_REASONING_EFFORTS = Object.freeze([
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "ultra",
  "max"
]);

function boundedString(value, label, maximum) {
  assertFloor(typeof value === "string", "AF_SPEC_INVALID", `${label} must be a string`);
  const trimmed = value.trim();
  assertFloor(trimmed.length > 0, "AF_SPEC_INVALID", `${label} cannot be empty`);
  assertFloor(
    Buffer.byteLength(trimmed, "utf8") <= maximum,
    "AF_SPEC_TOO_LARGE",
    `${label} exceeds ${maximum} bytes`
  );
  return trimmed;
}

function identifier(value, label) {
  const checked = boundedString(value, label, 80);
  assertFloor(
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(checked),
    "AF_SPEC_INVALID",
    `${label} may contain only letters, numbers, dot, underscore, and hyphen`
  );
  return checked;
}

function boundedInteger(value, label, minimum, maximum) {
  assertFloor(
    Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    "AF_LIMIT_INVALID",
    `${label} must be an integer from ${minimum} through ${maximum}`,
    { value, minimum, maximum }
  );
  return value;
}

function boundedStringArray(value, label, options = {}) {
  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? 16;
  const bytes = options.bytes ?? 160;
  assertFloor(Array.isArray(value), "AF_SPEC_INVALID", `${label} must be an array`);
  assertFloor(
    value.length >= minimum && value.length <= maximum,
    "AF_SPEC_INVALID",
    `${label} must contain ${minimum}-${maximum} entries`
  );
  const checked = value.map((item, index) => boundedString(item, `${label}[${index}]`, bytes));
  assertFloor(new Set(checked).size === checked.length, "AF_SPEC_INVALID", `${label} contains duplicates`);
  return checked;
}

export async function validateTaskSpec(raw, options = {}) {
  assertFloor(raw && typeof raw === "object" && !Array.isArray(raw), "AF_SPEC_INVALID", "Task spec must be an object");
  assertFloor(raw.version === 1, "AF_SPEC_VERSION", "Only Agent Floor task spec version 1 is accepted");

  const specDir = path.resolve(options.specDir ?? process.cwd());
  const boundaryInput = boundedString(raw.repository_boundary, "repository_boundary", 4096);
  const boundaryCandidate = path.resolve(specDir, boundaryInput);
  let boundary;
  try {
    boundary = await realpath(boundaryCandidate);
  } catch (error) {
    throw new AgentFloorError(
      "AF_REPOSITORY_MISSING",
      `Repository boundary does not exist: ${boundaryCandidate}`,
      { cause: error.message }
    );
  }
  const boundaryStat = await stat(boundary);
  assertFloor(boundaryStat.isDirectory(), "AF_REPOSITORY_INVALID", "Repository boundary must be a directory");

  const worker = raw.worker;
  assertFloor(worker && typeof worker === "object" && !Array.isArray(worker), "AF_SPEC_INVALID", "worker must be an object");
  assertFloor(!("children" in worker), "AF_DEPTH_EXCEEDED", "Nested child declarations are forbidden at AF-G0");

  const allowedPathsInput = worker.allowed_paths;
  assertFloor(Array.isArray(allowedPathsInput), "AF_SPEC_INVALID", "worker.allowed_paths must be an array");
  assertFloor(
    allowedPathsInput.length > 0 && allowedPathsInput.length <= FLOOR_LIMITS.maxAllowedPaths,
    "AF_SPEC_INVALID",
    `worker.allowed_paths must contain 1-${FLOOR_LIMITS.maxAllowedPaths} paths`
  );
  const allowedPaths = [];
  for (const candidate of allowedPathsInput) {
    const relative = assertSafeRelativePath(candidate);
    const absoluteCandidate = path.resolve(boundary, relative);
    let resolved;
    try {
      resolved = await realpath(absoluteCandidate);
    } catch (error) {
      throw new AgentFloorError(
        "AF_AUTHORITY_FILE_MISSING",
        `Allowed path does not exist: ${relative}`,
        { cause: error.message }
      );
    }
    assertFloor(isWithin(boundary, resolved), "AF_PATH_ESCAPE", `Allowed path escapes repository boundary: ${relative}`);
    const fileStat = await stat(resolved);
    assertFloor(fileStat.isFile(), "AF_PATH_NOT_FILE", `Allowed path is not a regular file: ${relative}`);
    allowedPaths.push(relative);
  }
  assertFloor(new Set(allowedPaths).size === allowedPaths.length, "AF_SPEC_INVALID", "worker.allowed_paths contains duplicates");

  const requirementsInput = worker.evidence_requirements;
  assertFloor(Array.isArray(requirementsInput), "AF_SPEC_INVALID", "worker.evidence_requirements must be an array");
  assertFloor(
    requirementsInput.length > 0 && requirementsInput.length <= FLOOR_LIMITS.maxEvidenceRequirements,
    "AF_SPEC_INVALID",
    `worker.evidence_requirements must contain 1-${FLOOR_LIMITS.maxEvidenceRequirements} entries`
  );
  const evidenceRequirements = requirementsInput.map((value, index) =>
    boundedString(value, `worker.evidence_requirements[${index}]`, 512)
  );

  const delegation = raw.delegation;
  assertFloor(delegation && typeof delegation === "object" && !Array.isArray(delegation), "AF_SPEC_INVALID", "delegation must be an object");
  if (delegation.fork_turns === "all") {
    throw new AgentFloorError(
      "AF_CONTEXT_FULL_HISTORY_FORBIDDEN",
      "fork_turns=all is mechanically forbidden; use a clean self-contained packet"
    );
  }
  assertFloor(
    delegation.context_mode === "clean" && delegation.fork_turns === "none",
    "AF_CONTEXT_NOT_CLEAN",
    "context_mode must be clean and fork_turns must be none"
  );
  assertFloor(delegation.sandbox === "read-only", "AF_AUTHORITY_TOO_BROAD", "AF-G0 workers must use the read-only sandbox");
  assertFloor(ALLOWED_MODELS.includes(delegation.model), "AF_MODEL_FORBIDDEN", `Model is outside the GPT-5.6 allowlist: ${delegation.model}`);
  assertFloor(
    ALLOWED_REASONING_EFFORTS.includes(delegation.reasoning_effort),
    "AF_REASONING_FORBIDDEN",
    `Unsupported reasoning effort: ${delegation.reasoning_effort}`
  );

  const maxDepth = boundedInteger(delegation.max_depth, "delegation.max_depth", 1, FLOOR_LIMITS.maxDepth);
  const maxConcurrency = boundedInteger(delegation.max_concurrency, "delegation.max_concurrency", 1, FLOOR_LIMITS.maxConcurrency);
  const maxCycles = boundedInteger(delegation.max_cycles, "delegation.max_cycles", 1, FLOOR_LIMITS.maxCycles);
  const maxRuntimeSeconds = boundedInteger(delegation.max_runtime_seconds, "delegation.max_runtime_seconds", 1, FLOOR_LIMITS.maxRuntimeSeconds);
  const maxOutputBytes = boundedInteger(delegation.max_output_bytes, "delegation.max_output_bytes", 256, FLOOR_LIMITS.maxOutputBytes);
  const maxIncrementalTokens = boundedInteger(
    delegation.max_incremental_tokens,
    "delegation.max_incremental_tokens",
    1,
    FLOOR_LIMITS.maxIncrementalTokens
  );

  const admission = raw.admission;
  assertFloor(admission && typeof admission === "object" && !Array.isArray(admission), "AF_SPEC_INVALID", "admission must be an object");
  const allowedStatuses = boundedStringArray(admission.allowed_statuses, "admission.allowed_statuses", {
    minimum: 1,
    maximum: 3,
    bytes: 20
  });
  assertFloor(
    allowedStatuses.every((value) => ["FOUND", "NO_FINDING", "BLOCKED"].includes(value)),
    "AF_SPEC_INVALID",
    "admission.allowed_statuses contains an unknown status"
  );
  const allowedFindingCodes = boundedStringArray(
    admission.allowed_finding_codes,
    "admission.allowed_finding_codes",
    { minimum: 1, maximum: 16, bytes: 80 }
  );
  assertFloor(
    allowedFindingCodes.every((value) => /^[A-Z][A-Z0-9_]{1,79}$/.test(value)),
    "AF_SPEC_INVALID",
    "admission.allowed_finding_codes must use uppercase machine identifiers"
  );
  const requiredOutputTerms = boundedStringArray(
    admission.required_output_terms,
    "admission.required_output_terms",
    { minimum: 0, maximum: 16, bytes: 120 }
  );
  const forbiddenOutputTerms = boundedStringArray(
    admission.forbidden_output_terms,
    "admission.forbidden_output_terms",
    { minimum: 0, maximum: 16, bytes: 120 }
  );
  const minimumEvidence = boundedInteger(admission.minimum_evidence, "admission.minimum_evidence", 0, 16);

  return {
    version: 1,
    root_task_id: identifier(raw.root_task_id, "root_task_id"),
    root_task: boundedString(raw.root_task, "root_task", 4096),
    repository_boundary: boundary,
    repository_boundary_input: boundaryInput,
    worker: {
      id: identifier(worker.id, "worker.id"),
      objective: boundedString(worker.objective, "worker.objective", 2048),
      allowed_paths: allowedPaths,
      evidence_requirements: evidenceRequirements
    },
    admission: {
      allowed_statuses: allowedStatuses,
      allowed_finding_codes: allowedFindingCodes,
      required_output_terms: requiredOutputTerms,
      forbidden_output_terms: forbiddenOutputTerms,
      minimum_evidence: minimumEvidence
    },
    delegation: {
      context_mode: "clean",
      fork_turns: "none",
      model: delegation.model,
      reasoning_effort: delegation.reasoning_effort,
      max_depth: maxDepth,
      max_concurrency: maxConcurrency,
      max_cycles: maxCycles,
      max_runtime_seconds: maxRuntimeSeconds,
      max_output_bytes: maxOutputBytes,
      max_incremental_tokens: maxIncrementalTokens,
      sandbox: "read-only"
    }
  };
}

export async function loadTaskSpec(specPath) {
  const absolute = path.resolve(specPath);
  let raw;
  try {
    raw = JSON.parse(await readFile(absolute, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AgentFloorError("AF_JSON_INVALID", `Invalid JSON in ${absolute}`, { cause: error.message });
    }
    throw new AgentFloorError("AF_FILE_READ_FAILED", `Cannot read task spec ${absolute}`, { cause: error.message }, 1);
  }
  const spec = await validateTaskSpec(raw, { specDir: path.dirname(absolute) });
  return { spec, raw, specPath: absolute };
}
