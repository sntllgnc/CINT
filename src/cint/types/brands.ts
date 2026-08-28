declare const scalarBrand: unique symbol;
declare const roleBrand: unique symbol;

export type Brand<Value, Name extends string> = Value & {
  readonly [scalarBrand]: Name;
};

type Role<Base, Name extends string> = Base & {
  readonly [roleBrand]: Name;
};

export type CanonicalJson = Brand<string, "CanonicalJson">;
export type CanonicalInstant = Brand<string, "CanonicalInstant">;
export type ProtocolIdentifier = Brand<string, "ProtocolIdentifier">;
export type Identifier = Brand<string, "Identifier">;
export type Sha256Digest = Brand<string, "Sha256Digest">;
export type HmacSha256Signature = Role<Sha256Digest, "HmacSha256Signature">;

export type PrincipalId = Role<Identifier, "PrincipalId">;
export type AuthorityId = Role<Identifier, "AuthorityId">;
export type PolicyId = Role<Identifier, "PolicyId">;
export type IntentId = Role<Identifier, "IntentId">;
export type DecisionId = Role<Identifier, "DecisionId">;
export type ReceiptId = Role<Identifier, "ReceiptId">;
export type AdapterId = Role<Identifier, "AdapterId">;
export type MachineStateId = Role<Identifier, "MachineStateId">;
export type SealId = Role<Identifier, "SealId">;

export type TargetDigest = Role<Sha256Digest, "TargetDigest">;
export type ActionDigest = Role<Sha256Digest, "ActionDigest">;
export type ContextDigest = Role<Sha256Digest, "ContextDigest">;
export type RecordDigest = Role<Sha256Digest, "RecordDigest">;
export type IntentDigest = Role<Sha256Digest, "IntentDigest">;
export type DecisionDigest = Role<Sha256Digest, "DecisionDigest">;
export type ReceiptDigest = Role<Sha256Digest, "ReceiptDigest">;
export type BindingDigest = Role<Sha256Digest, "BindingDigest">;
export type OutcomeDigest = Role<Sha256Digest, "OutcomeDigest">;
export type ExecutionDigest = Role<Sha256Digest, "ExecutionDigest">;
export type VerificationDigest = Role<Sha256Digest, "VerificationDigest">;
export type RevalidationDigest = Role<Sha256Digest, "RevalidationDigest">;
export type ConsumptionDigest = Role<Sha256Digest, "ConsumptionDigest">;
export type EvidenceSealDigest = Role<Sha256Digest, "EvidenceSealDigest">;
export type MachineStateDigest = Role<Sha256Digest, "MachineStateDigest">;

export type Epoch = Brand<number, "Epoch">;
