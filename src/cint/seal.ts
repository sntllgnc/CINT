import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  assertCint,
  assertExactKeys,
  assertJsonValue,
  canonicalJson,
  identifier,
  isPlainRecord,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifyProtocolRecord,
  verifySealedRecord
} from "./canonical.js";
import { verifyExecutionLedgerEntry, type ExecutionLedgerEntry } from "./evidence.js";
import type {
  ConsumptionDigest,
  HmacSha256Signature,
  Identifier,
  ReceiptDigest,
  ReceiptId,
  RevalidationDigest,
  SealId
} from "./types/brands.js";
import type {
  ConsumedReceiptRecord,
  EvidenceSeal,
  IssuedDecisionReceipt,
  Outcome,
  Revalidation
} from "./types/records.js";
import type { JsonObject } from "./types/protocols.js";

export interface OutcomeSealInput {
  readonly receipt: IssuedDecisionReceipt;
  readonly consumption: ConsumedReceiptRecord;
  readonly revalidation: Revalidation;
  readonly outcome: Outcome;
  readonly ledger_head: ExecutionLedgerEntry;
  readonly issued_at: unknown;
  readonly id?: unknown;
}

function unsignedSeal(seal: EvidenceSeal): JsonObject {
  const unsigned = assertJsonValue(
    Object.fromEntries(Object.entries(seal).filter(([key]) => key !== "digest" && key !== "signature")),
    "unsigned evidence seal"
  );
  assertCint(isPlainRecord(unsigned), "CINT_OBJECT_INVALID", "Unsigned evidence seal must be an object");
  return unsigned;
}

function consumedReceipt(value: unknown): ConsumedReceiptRecord {
  const record = verifySealedRecord(value, "consumption");
  assertCint(
    record["protocol"] === "cint/receipt-store-entry/1" && record["state"] === "CONSUMED",
    "CINT_RECEIPT_STORE_MISMATCH",
    "Evidence sealing requires a consumed receipt record"
  );
  return {
    protocol: "cint/receipt-store-entry/1",
    state: "CONSUMED",
    receipt_id: identifier<ReceiptId>(record["receipt_id"], "consumption receipt_id"),
    receipt_digest: sha256Digest<ReceiptDigest>(record["receipt_digest"], "consumption receipt_digest"),
    consumed_at: isoInstant(record["consumed_at"], "consumption consumed_at"),
    revalidation_digest: sha256Digest<RevalidationDigest>(record["revalidation_digest"], "consumption revalidation_digest"),
    digest: sha256Digest<ConsumptionDigest>(record["digest"], "consumption digest")
  };
}

function ledgerHead(value: unknown): ExecutionLedgerEntry {
  return verifyExecutionLedgerEntry(value, "ledger head");
}

export class OutcomeSealAuthority {
  readonly issuer_id: Identifier;
  #key: Buffer;

  constructor(value: unknown) {
    const input = assertExactKeys(value, ["issuer_id", "key"], [], "seal authority");
    this.issuer_id = identifier<Identifier>(input["issuer_id"], "seal authority issuer_id");
    const rawKey = input["key"];
    const key = Buffer.isBuffer(rawKey) ? Buffer.from(rawKey) : Buffer.from(String(rawKey), "utf8");
    assertCint(key.byteLength >= 32, "CINT_SEAL_KEY_INVALID", "Seal authority key must contain at least 32 bytes");
    this.#key = key;
    Object.freeze(this);
  }

  #sign(value: unknown): HmacSha256Signature {
    return sha256Digest<HmacSha256Signature>(
      createHmac("sha256", this.#key).update(canonicalJson(assertJsonValue(value))).digest("hex"),
      "evidence seal signature"
    );
  }

  issue(input: OutcomeSealInput): EvidenceSeal;
  issue(value: unknown): EvidenceSeal {
    const input = assertExactKeys(
      value,
      ["receipt", "consumption", "revalidation", "outcome", "ledger_head", "issued_at"],
      ["id"],
      "outcome seal issuance"
    );
    const receipt = verifyProtocolRecord(input["receipt"], "cint/decision-receipt/1", "receipt");
    const consumption = consumedReceipt(input["consumption"]);
    const revalidation = verifyProtocolRecord(input["revalidation"], "cint/revalidation/1", "revalidation");
    const outcome = verifyProtocolRecord(input["outcome"], "cint/outcome/1", "outcome");
    const head = ledgerHead(input["ledger_head"]);
    assertCint(outcome.status === "VERIFIED" || outcome.status === "ROLLED_BACK", "CINT_SEAL_OUTCOME_INVALID", "Only verified or restored outcomes can be sealed");
    assertCint(outcome.receipt_digest === receipt.digest, "CINT_SEAL_BINDING_INVALID", "Outcome is bound to a different receipt");
    assertCint(consumption.receipt_digest === receipt.digest, "CINT_SEAL_BINDING_INVALID", "Consumption is bound to a different receipt");
    assertCint(revalidation.receipt_id === receipt.id, "CINT_SEAL_BINDING_INVALID", "Revalidation is bound to a different receipt");
    const unsigned = {
      protocol: "cint/evidence-seal/1" as const,
      id: identifier<SealId>(input["id"] ?? `seal.${randomUUID()}`, "evidence seal id"),
      issuer_id: this.issuer_id,
      status: "SEALED" as const,
      outcome_status: outcome.status,
      receipt_id: receipt.id,
      receipt_digest: receipt.digest,
      consumption_digest: consumption.digest,
      revalidation_digest: revalidation.digest,
      outcome_digest: outcome.digest,
      ledger_head_digest: head.digest,
      issued_at: isoInstant(input["issued_at"], "evidence seal issued_at"),
      signature_algorithm: "HMAC-SHA256" as const
    };
    return sealRecord({ ...unsigned, signature: this.#sign(unsigned) });
  }

  verify(value: unknown): EvidenceSeal {
    const seal = verifyProtocolRecord(value, "cint/evidence-seal/1", "evidence seal");
    assertExactKeys(
      seal,
      [
        "protocol",
        "id",
        "issuer_id",
        "status",
        "outcome_status",
        "receipt_id",
        "receipt_digest",
        "consumption_digest",
        "revalidation_digest",
        "outcome_digest",
        "ledger_head_digest",
        "issued_at",
        "signature_algorithm",
        "signature",
        "digest"
      ],
      [],
      "evidence seal"
    );
    assertCint(
      seal.protocol === "cint/evidence-seal/1" && seal.status === "SEALED",
      "CINT_SEAL_INVALID",
      "Unsupported evidence seal"
    );
    assertCint(seal.issuer_id === this.issuer_id, "CINT_SEAL_ISSUER_MISMATCH", "Evidence seal issuer mismatch");
    for (const field of [
      "receipt_digest",
      "consumption_digest",
      "revalidation_digest",
      "outcome_digest",
      "ledger_head_digest",
      "signature"
    ] as const) {
      sha256Digest(seal[field], `evidence seal ${field}`);
    }
    const expected = Buffer.from(this.#sign(unsignedSeal(seal)), "hex");
    const actual = Buffer.from(seal.signature, "hex");
    assertCint(
      expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual),
      "CINT_SEAL_SIGNATURE_INVALID",
      "Evidence seal signature is invalid"
    );
    return seal;
  }
}
