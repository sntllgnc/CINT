export type CintProtocol =
  | "cint/adapter-capability/1"
  | "cint/authority/1"
  | "cint/challenge/1"
  | "cint/decision/1"
  | "cint/execution-result/1"
  | "cint/intent/1"
  | "cint/machine-state/1"
  | "cint/outcome/1"
  | "cint/policy/1"
  | "cint/principal/1"
  | "cint/decision-receipt/1"
  | "cint/revalidation/1"
  | "cint/evidence-seal/1";

export type InternalCintProtocol =
  | CintProtocol
  | "cint/receipt-store-entry/1"
  | "cint/outcome-verification/1"
  | "cint/rollback/1"
  | "cint/rollback-failure/1"
  | "cint/state-machine/1"
  | "cint/synthetic-execution/1"
  | "cint/codex-delegation-execution/1"
  | "cint/execution-interruption/1"
  | "cint/execution-ledger/1";

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export interface UnknownProtocolRecord {
  readonly protocol?: unknown;
  readonly [key: string]: unknown;
}
