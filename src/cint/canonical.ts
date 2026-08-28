import { createHash } from "node:crypto";

import { validateCintSchema } from "./schema.js";
import type {
  CanonicalInstant,
  CanonicalJson,
  ConsumptionDigest,
  DecisionDigest,
  EvidenceSealDigest,
  ExecutionDigest,
  Identifier,
  IntentDigest,
  OutcomeDigest,
  ReceiptDigest,
  RecordDigest,
  RevalidationDigest,
  Sha256Digest,
  VerificationDigest
} from "./types/brands.js";
import type {
  AdapterCapability,
  AuthorityRecord,
  ChallengeRecord,
  Decision,
  EvidenceSeal,
  ExecutionResult,
  IntentRecord,
  IssuedDecisionReceipt,
  MachineStateSnapshot,
  Outcome,
  PolicySnapshot,
  PrincipalRecord,
  Revalidation
} from "./types/records.js";
import type { JsonObject, JsonValue } from "./types/protocols.js";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256 = /^[a-f0-9]{64}$/;

export type JsonRecord = Record<string, unknown>;
export type VerifiedSealedRecord = JsonRecord & { readonly digest: Sha256Digest };

type ProtocolRecordMap = {
  readonly "cint/adapter-capability/1": AdapterCapability;
  readonly "cint/authority/1": AuthorityRecord;
  readonly "cint/challenge/1": ChallengeRecord;
  readonly "cint/decision/1": Decision;
  readonly "cint/execution-result/1": ExecutionResult;
  readonly "cint/intent/1": IntentRecord;
  readonly "cint/machine-state/1": MachineStateSnapshot;
  readonly "cint/outcome/1": Outcome;
  readonly "cint/policy/1": PolicySnapshot;
  readonly "cint/principal/1": PrincipalRecord;
  readonly "cint/decision-receipt/1": IssuedDecisionReceipt;
  readonly "cint/revalidation/1": Revalidation;
  readonly "cint/evidence-seal/1": EvidenceSeal;
};

type DigestFor<Value> =
  Value extends { readonly protocol: "cint/intent/1" } ? IntentDigest :
  Value extends { readonly protocol: "cint/decision/1" } ? DecisionDigest :
  Value extends { readonly protocol: "cint/decision-receipt/1" } ? ReceiptDigest :
  Value extends { readonly protocol: "cint/revalidation/1" } ? RevalidationDigest :
  Value extends { readonly protocol: "cint/outcome/1" } ? OutcomeDigest :
  Value extends { readonly protocol: "cint/evidence-seal/1" } ? EvidenceSealDigest :
  Value extends { readonly protocol: "cint/outcome-verification/1" } ? VerificationDigest :
  Value extends { readonly protocol: "cint/synthetic-execution/1" | "cint/codex-delegation-execution/1" | "cint/execution-interruption/1" } ? ExecutionDigest :
  Value extends { readonly protocol: "cint/receipt-store-entry/1"; readonly state: "CONSUMED" } ? ConsumptionDigest :
  RecordDigest;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class CintError extends Error {
  override name = "CintError";
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details: unknown = undefined) {
    super(message);
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}

export function assertCint(
  condition: unknown,
  code: string,
  message: string,
  details: unknown = undefined
): asserts condition {
  if (!condition) throw new CintError(code, message, details);
}

export function isPlainRecord(value: unknown): value is JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function assertExactKeys(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
  label = "object"
): JsonRecord {
  assertCint(isPlainRecord(value), "CINT_OBJECT_INVALID", `${label} must be a plain JSON object`);
  const allowed = new Set([...required, ...optional]);
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  assertCint(unknown.length === 0, "CINT_UNKNOWN_FIELD", `${label} contains unknown fields`, { unknown });
  assertCint(missing.length === 0, "CINT_REQUIRED_FIELD", `${label} is missing required fields`, { missing });
  return value;
}

export function assertJsonValue(value: unknown, label = "value"): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    assertCint(Number.isFinite(value), "CINT_JSON_INVALID", `${label} must contain only finite numbers`);
    return value;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${label}[${index}]`));
    return value as JsonValue;
  }
  assertCint(isPlainRecord(value), "CINT_JSON_INVALID", `${label} must contain only JSON values`);
  for (const [key, item] of Object.entries(value)) {
    assertCint(typeof key === "string", "CINT_JSON_INVALID", `${label} has an invalid key`);
    assertJsonValue(item, `${label}.${key}`);
  }
  return value as JsonObject;
}

export function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

export function canonicalJson(value: JsonValue): CanonicalJson {
  return JSON.stringify(canonicalize(value)) as CanonicalJson;
}

export function sha256<Digest extends Sha256Digest = Sha256Digest>(value: string | Uint8Array): Digest {
  return createHash("sha256").update(value).digest("hex") as Digest;
}

export function identifier<IdentifierType extends Identifier = Identifier>(
  value: unknown,
  label = "identifier"
): IdentifierType {
  assertCint(typeof value === "string" && IDENTIFIER.test(value), "CINT_IDENTIFIER_INVALID", `${label} is invalid`);
  return value as IdentifierType;
}

export interface BoundedStringOptions {
  readonly minimum?: number;
  readonly maximum?: number;
}

export function boundedString(value: unknown, label: string, options: BoundedStringOptions = {}): string {
  const minimum = options.minimum ?? 1;
  const maximum = options.maximum ?? 4096;
  assertCint(typeof value === "string", "CINT_STRING_INVALID", `${label} must be a string`);
  const bytes = Buffer.byteLength(value, "utf8");
  assertCint(bytes >= minimum && bytes <= maximum, "CINT_STRING_INVALID", `${label} must contain ${minimum}-${maximum} bytes`, { bytes });
  return value;
}

export interface StringArrayOptions {
  readonly minimum?: number;
  readonly maximum?: number;
  readonly itemMinimum?: number;
  readonly itemMaximum?: number;
  readonly bytes?: number;
}

export function stringArray(value: unknown, label: string, options: StringArrayOptions = {}): string[] {
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

export interface IntegerOptions {
  readonly minimum?: number;
  readonly maximum?: number;
}

export function integer<NumberType extends number = number>(
  value: unknown,
  label: string,
  options: IntegerOptions = {}
): NumberType {
  const minimum = options.minimum ?? 0;
  const maximum = options.maximum ?? Number.MAX_SAFE_INTEGER;
  assertCint(
    typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    "CINT_INTEGER_INVALID",
    `${label} must be an integer from ${minimum} through ${maximum}`
  );
  return value as NumberType;
}

export function isoInstant(value: unknown, label = "timestamp"): CanonicalInstant {
  const checked = boundedString(value, label, { minimum: 24, maximum: 32 });
  const parsed = new Date(checked);
  assertCint(!Number.isNaN(parsed.valueOf()) && parsed.toISOString() === checked, "CINT_TIME_INVALID", `${label} must be a canonical UTC instant`);
  return checked as CanonicalInstant;
}

export function sha256Digest<Digest extends Sha256Digest = Sha256Digest>(
  value: unknown,
  label = "sha256"
): Digest {
  assertCint(typeof value === "string" && SHA256.test(value), "CINT_DIGEST_INVALID", `${label} must be a lowercase SHA-256 digest`);
  return value as Digest;
}

export function canonicalDigest<Digest extends Sha256Digest = Sha256Digest>(value: unknown): Digest {
  return sha256<Digest>(canonicalJson(assertJsonValue(value)));
}

export function parseCanonicalJson(text: string, label = "JSON"): JsonValue {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new CintError("CINT_JSON_INVALID", `${label} is not valid JSON`, { cause: errorMessage(error) });
  }
  const checked = assertJsonValue(value, label);
  assertCint(text === canonicalJson(checked), "CINT_JSON_NOT_CANONICAL", `${label} must use canonical JSON encoding`);
  return checked;
}

export function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

export function immutableRecord<Value>(value: Value): Value;
export function immutableRecord(value: unknown): unknown {
  const checked = assertJsonValue(value);
  return deepFreeze(canonicalize(checked));
}

export function sealRecord<Value extends object>(value: Value): Readonly<Value & { digest: DigestFor<Value> }>;
export function sealRecord(value: object): object {
  assertCint(!Object.hasOwn(value, "digest"), "CINT_DIGEST_PRESET", "Record digest must be computed by CINT");
  const canonical = canonicalize(assertJsonValue(value));
  assertCint(isPlainRecord(canonical), "CINT_OBJECT_INVALID", "Record must remain a plain JSON object");
  const sealed: JsonRecord & { digest: Sha256Digest } = { ...canonical, digest: canonicalDigest(canonical) };
  const validation = validateCintSchema(sealed);
  assertCint(
    !validation.known || validation.valid,
    "CINT_SCHEMA_INVALID",
    `Record does not satisfy the ${String(sealed["protocol"])} runtime schema`,
    { errors: validation.errors }
  );
  const immutable = immutableRecord(assertJsonValue(sealed));
  assertCint(isPlainRecord(immutable), "CINT_OBJECT_INVALID", "Sealed record must be an object");
  return immutable;
}

export function verifySealedRecord(value: unknown, label = "record"): VerifiedSealedRecord {
  assertCint(isPlainRecord(value), "CINT_RECORD_INVALID", `${label} must be an object`);
  const digest = sha256Digest(value["digest"], `${label}.digest`);
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "digest"));
  assertCint(
    canonicalDigest(unsigned) === digest,
    "CINT_RECORD_TAMPERED",
    `${label} digest does not match its content`
  );
  const validation = validateCintSchema(value);
  assertCint(
    !validation.known || validation.valid,
    "CINT_SCHEMA_INVALID",
    `${label} does not satisfy the ${String(value["protocol"])} runtime schema`,
    { errors: validation.errors }
  );
  return value as VerifiedSealedRecord;
}

export function verifyProtocolRecord<Protocol extends keyof ProtocolRecordMap>(
  value: unknown,
  protocol: Protocol,
  label?: string
): ProtocolRecordMap[Protocol];
export function verifyProtocolRecord(
  value: unknown,
  protocol: keyof ProtocolRecordMap,
  label = "record"
): unknown {
  const record = verifySealedRecord(value, label);
  assertCint(record["protocol"] === protocol, "CINT_PROTOCOL_INVALID", `${label} uses an unsupported protocol`, {
    expected: protocol,
    actual: record["protocol"] ?? null
  });
  const validation = validateCintSchema(record, protocol);
  assertCint(validation.known, "CINT_SCHEMA_UNAVAILABLE", `Runtime schema is unavailable for ${protocol}`);
  assertCint(validation.valid, "CINT_SCHEMA_INVALID", `${label} does not satisfy the ${protocol} runtime schema`, {
    errors: validation.errors
  });
  return record;
}
