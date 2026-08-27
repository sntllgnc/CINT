import { readFileSync } from "node:fs";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const SCHEMA_DIRECTORY = new URL("../../schemas/cint/", import.meta.url);

const SCHEMA_FILES = Object.freeze([
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

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const schemas = SCHEMA_FILES.map(([protocol, file]) => {
  const schema = JSON.parse(readFileSync(new URL(file, SCHEMA_DIRECTORY), "utf8"));
  if (schema.properties?.protocol?.const !== protocol) {
    throw new Error(`CINT schema protocol mismatch: ${file}`);
  }
  ajv.addSchema(schema);
  return [protocol, schema.$id];
});

const validators = new Map(
  schemas.map(([protocol, schemaId]) => {
    const validator = ajv.getSchema(schemaId);
    if (!validator) throw new Error(`CINT schema did not compile: ${schemaId}`);
    return [protocol, validator];
  })
);

export const CINT_SCHEMA_PROTOCOLS = Object.freeze(SCHEMA_FILES.map(([protocol]) => protocol));

function safeErrors(errors = []) {
  return errors.map(({ instancePath, keyword, message, params }) => ({
    instancePath,
    keyword,
    message,
    params
  }));
}

export function validateCintSchema(value, protocol = value?.protocol) {
  const validator = validators.get(protocol);
  if (!validator) return Object.freeze({ known: false, valid: false, errors: [] });
  const valid = validator(value);
  return Object.freeze({
    known: true,
    valid,
    errors: valid ? [] : safeErrors(validator.errors)
  });
}
