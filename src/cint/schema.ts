import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction
} from "ajv/dist/2020.js";

import type { CintProtocol } from "./types/protocols.js";

const SCHEMA_DIRECTORY = new URL("../../schemas/cint/", import.meta.url);

const SCHEMA_FILES: readonly (readonly [CintProtocol, string])[] = Object.freeze([
  ["cint/adapter-capability/1", "adapter-capability.schema.json"],
  ["cint/authority/1", "authority.schema.json"],
  ["cint/challenge/1", "challenge.schema.json"],
  ["cint/decision/1", "decision.schema.json"],
  ["cint/execution-result/1", "execution-result.schema.json"],
  ["cint/intent/1", "intent.schema.json"],
  ["cint/machine-state/1", "machine-state.schema.json"],
  ["cint/outcome/1", "outcome.schema.json"],
  ["cint/policy/1", "policy.schema.json"],
  ["cint/principal/1", "principal.schema.json"],
  ["cint/decision-receipt/1", "receipt.schema.json"],
  ["cint/revalidation/1", "revalidation.schema.json"],
  ["cint/evidence-seal/1", "seal.schema.json"]
]);

interface SchemaDocument {
  readonly $id: string;
  readonly properties: {
    readonly protocol: {
      readonly const: string;
    };
  };
}

export interface CintSchemaError {
  readonly instancePath: string;
  readonly keyword: string;
  readonly message?: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface CintSchemaValidation {
  readonly known: boolean;
  readonly valid: boolean;
  readonly errors: readonly CintSchemaError[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSchemaDocument(value: unknown, protocol: CintProtocol): value is SchemaDocument {
  if (!isRecord(value) || typeof value["$id"] !== "string") return false;
  const properties = value["properties"];
  if (!isRecord(properties)) return false;
  const protocolProperty = properties["protocol"];
  return isRecord(protocolProperty) && protocolProperty["const"] === protocol;
}

function readSchema(file: string, protocol: CintProtocol): SchemaDocument {
  const parsed: unknown = JSON.parse(readFileSync(new URL(file, SCHEMA_DIRECTORY), "utf8"));
  if (!isSchemaDocument(parsed, protocol)) {
    throw new Error(`CINT schema protocol mismatch: ${file}`);
  }
  return parsed;
}

function protocolOf(value: unknown): unknown {
  return isRecord(value) ? value["protocol"] : undefined;
}

const require = createRequire(import.meta.url);
const addFormats: (instance: Ajv2020) => Ajv2020 = require("ajv-formats");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const schemas = SCHEMA_FILES.map(([protocol, file]) => {
  const schema = readSchema(file, protocol);
  ajv.addSchema(schema);
  return [protocol, schema.$id] as const;
});

const validators = new Map<CintProtocol, ValidateFunction<unknown>>(
  schemas.map(([protocol, schemaId]) => {
    const validator = ajv.getSchema<unknown>(schemaId);
    if (!validator) throw new Error(`CINT schema did not compile: ${schemaId}`);
    return [protocol, validator] as const;
  })
);

export const CINT_SCHEMA_PROTOCOLS: readonly CintProtocol[] = Object.freeze(
  SCHEMA_FILES.map(([protocol]) => protocol)
);

function safeErrors(errors: readonly ErrorObject[] | null | undefined = []): CintSchemaError[] {
  return (errors ?? []).map(({ instancePath, keyword, message, params }) => {
    const safe: CintSchemaError = message === undefined
      ? { instancePath, keyword, params }
      : { instancePath, keyword, message, params };
    return safe;
  });
}

export function validateCintSchema(
  value: unknown,
  protocol: unknown = protocolOf(value)
): Readonly<CintSchemaValidation> {
  if (typeof protocol !== "string") {
    return Object.freeze({ known: false, valid: false, errors: [] });
  }
  const validator = validators.get(protocol as CintProtocol);
  if (!validator) return Object.freeze({ known: false, valid: false, errors: [] });
  const valid = validator(value);
  return Object.freeze({
    known: true,
    valid,
    errors: valid ? [] : safeErrors(validator.errors)
  });
}
