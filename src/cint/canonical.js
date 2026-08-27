import { canonicalJson, canonicalize, sha256 } from "../util.js";
import { validateCintSchema } from "./schema.js";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export class CintError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "CintError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function assertCint(condition, code, message, details = undefined) {
  if (!condition) throw new CintError(code, message, details);
}

export function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertExactKeys(value, required, optional = [], label = "object") {
  assertCint(isPlainRecord(value), "CINT_OBJECT_INVALID", `${label} must be a plain JSON object`);
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  assertCint(unknown.length === 0, "CINT_UNKNOWN_FIELD", `${label} contains unknown fields`, { unknown });
  assertCint(missing.length === 0, "CINT_REQUIRED_FIELD", `${label} is missing required fields`, { missing });
  return value;
}

export function assertJsonValue(value, label = "value") {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    assertCint(Number.isFinite(value), "CINT_JSON_INVALID", `${label} must contain only finite numbers`);
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${label}[${index}]`));
    return value;
  }
  assertCint(isPlainRecord(value), "CINT_JSON_INVALID", `${label} must contain only JSON values`);
  for (const [key, item] of Object.entries(value)) {
    assertCint(typeof key === "string", "CINT_JSON_INVALID", `${label} has an invalid key`);
    assertJsonValue(item, `${label}.${key}`);
  }
  return value;
}

export function identifier(value, label = "identifier") {
  assertCint(typeof value === "string" && IDENTIFIER.test(value), "CINT_IDENTIFIER_INVALID", `${label} is invalid`);
  return value;
}

export function boundedString(value, label, options = {}) {
  const minimum = options.minimum ?? 1;
  const maximum = options.maximum ?? 4096;
  assertCint(typeof value === "string", "CINT_STRING_INVALID", `${label} must be a string`);
  const bytes = Buffer.byteLength(value, "utf8");
  assertCint(bytes >= minimum && bytes <= maximum, "CINT_STRING_INVALID", `${label} must contain ${minimum}-${maximum} bytes`, { bytes });
  return value;
}

export function stringArray(value, label, options = {}) {
  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? 32;
  const itemMinimum = options.itemMinimum ?? 1;
  const itemMaximum = options.itemMaximum ?? options.bytes ?? 512;
  assertCint(Array.isArray(value), "CINT_ARRAY_INVALID", `${label} must be an array`);
  assertCint(value.length >= minimum && value.length <= maximum, "CINT_ARRAY_INVALID", `${label} must contain ${minimum}-${maximum} items`);
  const checked = value.map((item, index) =>
    boundedString(item, `${label}[${index}]`, { minimum: itemMinimum, maximum: itemMaximum })
  );
  assertCint(new Set(checked).size === checked.length, "CINT_ARRAY_DUPLICATE", `${label} contains duplicates`);
  return checked;
}

export function integer(value, label, options = {}) {
  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? Number.MAX_SAFE_INTEGER;
  assertCint(Number.isSafeInteger(value) && value >= minimum && value <= maximum, "CINT_INTEGER_INVALID", `${label} must be an integer from ${minimum} through ${maximum}`);
  return value;
}

export function isoInstant(value, label = "timestamp") {
  boundedString(value, label, { minimum: 24, maximum: 32 });
  const parsed = new Date(value);
  assertCint(!Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value, "CINT_TIME_INVALID", `${label} must be a canonical UTC instant`);
  return value;
}

export function sha256Digest(value, label = "sha256") {
  assertCint(typeof value === "string" && SHA256.test(value), "CINT_DIGEST_INVALID", `${label} must be a lowercase SHA-256 digest`);
  return value;
}

export function canonicalDigest(value) {
  assertJsonValue(value);
  return sha256(canonicalJson(value));
}

export function parseCanonicalJson(text, label = "JSON") {
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new CintError("CINT_JSON_INVALID", `${label} is not valid JSON`, { cause: error.message });
  }
  assertJsonValue(value, label);
  assertCint(text === canonicalJson(value), "CINT_JSON_NOT_CANONICAL", `${label} must use canonical JSON encoding`);
  return value;
}

export function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

export function immutableRecord(value) {
  assertJsonValue(value);
  return deepFreeze(canonicalize(value));
}

export function sealRecord(value) {
  assertCint(!Object.hasOwn(value, "digest"), "CINT_DIGEST_PRESET", "Record digest must be computed by CINT");
  const canonical = canonicalize(value);
  const sealed = { ...canonical, digest: canonicalDigest(canonical) };
  const validation = validateCintSchema(sealed);
  assertCint(
    !validation.known || validation.valid,
    "CINT_SCHEMA_INVALID",
    `Record does not satisfy the ${sealed.protocol} runtime schema`,
    { errors: validation.errors }
  );
  return immutableRecord(sealed);
}

export function verifySealedRecord(value, label = "record") {
  assertCint(isPlainRecord(value), "CINT_RECORD_INVALID", `${label} must be an object`);
  sha256Digest(value.digest, `${label}.digest`);
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "digest"));
  assertCint(
    canonicalDigest(unsigned) === value.digest,
    "CINT_RECORD_TAMPERED",
    `${label} digest does not match its content`
  );
  const validation = validateCintSchema(value);
  assertCint(
    !validation.known || validation.valid,
    "CINT_SCHEMA_INVALID",
    `${label} does not satisfy the ${value.protocol} runtime schema`,
    { errors: validation.errors }
  );
  return value;
}

export function verifyProtocolRecord(value, protocol, label = "record") {
  verifySealedRecord(value, label);
  assertCint(value.protocol === protocol, "CINT_PROTOCOL_INVALID", `${label} uses an unsupported protocol`, {
    expected: protocol,
    actual: value.protocol ?? null
  });
  const validation = validateCintSchema(value, protocol);
  assertCint(validation.known, "CINT_SCHEMA_UNAVAILABLE", `Runtime schema is unavailable for ${protocol}`);
  assertCint(validation.valid, "CINT_SCHEMA_INVALID", `${label} does not satisfy the ${protocol} runtime schema`, {
    errors: validation.errors
  });
  return value;
}
