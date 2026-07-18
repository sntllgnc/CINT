import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { AgentFloorError, assertFloor } from "./errors.js";

export function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function readJson(filePath) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    throw new AgentFloorError(
      "AF_FILE_READ_FAILED",
      `Cannot read ${filePath}`,
      { cause: error.message },
      1
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AgentFloorError(
      "AF_JSON_INVALID",
      `Invalid JSON in ${filePath}`,
      { cause: error.message }
    );
  }
}

export async function writeJsonAtomic(filePath, value) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, filePath);
}

export function isWithin(boundary, candidate) {
  const relative = path.relative(boundary, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertSafeRelativePath(relativePath) {
  assertFloor(
    typeof relativePath === "string" && relativePath.length > 0,
    "AF_PATH_INVALID",
    "Evidence and authority paths must be non-empty strings"
  );
  assertFloor(
    !path.isAbsolute(relativePath) && !relativePath.includes("\0"),
    "AF_PATH_ESCAPE",
    `Absolute or NUL-containing path rejected: ${relativePath}`
  );
  const normalized = path.normalize(relativePath);
  assertFloor(
    normalized !== ".." && !normalized.startsWith(`..${path.sep}`),
    "AF_PATH_ESCAPE",
    `Path leaves the repository boundary: ${relativePath}`
  );
  return normalized.split(path.sep).join("/");
}

export async function resolveInside(boundary, relativePath, options = {}) {
  const normalized = assertSafeRelativePath(relativePath);
  const joined = path.resolve(boundary, normalized);
  assertFloor(
    isWithin(boundary, joined),
    "AF_PATH_ESCAPE",
    `Path leaves the repository boundary: ${relativePath}`
  );
  if (options.mustExist === false) {
    return { absolute: joined, relative: normalized };
  }
  let resolved;
  try {
    resolved = await realpath(joined);
  } catch (error) {
    throw new AgentFloorError(
      "AF_EVIDENCE_FILE_MISSING",
      `File does not exist inside the repository boundary: ${normalized}`,
      { cause: error.message }
    );
  }
  assertFloor(
    isWithin(boundary, resolved),
    "AF_PATH_ESCAPE",
    `Resolved path leaves the repository boundary: ${relativePath}`
  );
  const metadata = await stat(resolved);
  assertFloor(
    metadata.isFile(),
    "AF_PATH_NOT_FILE",
    `Expected a regular file: ${normalized}`
  );
  return { absolute: resolved, relative: normalized, size: metadata.size };
}

export function normalizeLine(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

export function parseJsonLines(text, source = "JSONL") {
  const events = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch (error) {
      throw new AgentFloorError(
        "AF_JSONL_INVALID",
        `${source} line ${index + 1} is not valid JSON`,
        { cause: error.message }
      );
    }
  }
  return events;
}

export function asFiniteInteger(value, label) {
  assertFloor(
    Number.isSafeInteger(value) && value >= 0,
    "AF_NUMBER_INVALID",
    `${label} must be a non-negative safe integer`,
    { value }
  );
  return value;
}

export function formatMillions(value) {
  const precision = value >= 100_000_000 ? 1 : 2;
  return `${(value / 1_000_000).toFixed(precision)}M`;
}
