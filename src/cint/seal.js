import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { canonicalJson } from "../util.js";
import {
  assertCint,
  assertExactKeys,
  identifier,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifyProtocolRecord,
  verifySealedRecord
} from "./canonical.js";

function unsignedSeal(seal) {
  return Object.fromEntries(Object.entries(seal).filter(([key]) => key !== "digest" && key !== "signature"));
}

export class OutcomeSealAuthority {
  #key;

  constructor(input) {
    assertExactKeys(input, ["issuer_id", "key"], [], "seal authority");
    this.issuer_id = identifier(input.issuer_id, "seal authority issuer_id");
    const key = Buffer.isBuffer(input.key) ? Buffer.from(input.key) : Buffer.from(String(input.key), "utf8");
    assertCint(key.byteLength >= 32, "CINT_SEAL_KEY_INVALID", "Seal authority key must contain at least 32 bytes");
    this.#key = key;
    Object.freeze(this);
  }

  #sign(value) {
    return createHmac("sha256", this.#key).update(canonicalJson(value)).digest("hex");
  }

  issue(input) {
    assertExactKeys(
      input,
      ["receipt", "consumption", "revalidation", "outcome", "ledger_head", "issued_at"],
      ["id"],
      "outcome seal issuance"
    );
    verifyProtocolRecord(input.receipt, "cint/decision-receipt/1", "receipt");
    verifySealedRecord(input.consumption, "consumption");
    verifyProtocolRecord(input.revalidation, "cint/revalidation/1", "revalidation");
    verifyProtocolRecord(input.outcome, "cint/outcome/1", "outcome");
    verifySealedRecord(input.ledger_head, "ledger head");
    assertCint(["VERIFIED", "ROLLED_BACK"].includes(input.outcome.status), "CINT_SEAL_OUTCOME_INVALID", "Only verified or restored outcomes can be sealed");
    assertCint(input.outcome.receipt_digest === input.receipt.digest, "CINT_SEAL_BINDING_INVALID", "Outcome is bound to a different receipt");
    assertCint(input.consumption.receipt_digest === input.receipt.digest, "CINT_SEAL_BINDING_INVALID", "Consumption is bound to a different receipt");
    assertCint(input.revalidation.receipt_id === input.receipt.id, "CINT_SEAL_BINDING_INVALID", "Revalidation is bound to a different receipt");
    const unsigned = {
      protocol: "cint/evidence-seal/1",
      id: identifier(input.id ?? `seal.${randomUUID()}`, "evidence seal id"),
      issuer_id: this.issuer_id,
      status: "SEALED",
      outcome_status: input.outcome.status,
      receipt_id: input.receipt.id,
      receipt_digest: input.receipt.digest,
      consumption_digest: input.consumption.digest,
      revalidation_digest: input.revalidation.digest,
      outcome_digest: input.outcome.digest,
      ledger_head_digest: input.ledger_head.digest,
      issued_at: isoInstant(input.issued_at, "evidence seal issued_at"),
      signature_algorithm: "HMAC-SHA256"
    };
    return sealRecord({ ...unsigned, signature: this.#sign(unsigned) });
  }

  verify(seal) {
    verifyProtocolRecord(seal, "cint/evidence-seal/1", "evidence seal");
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
    assertCint(seal.protocol === "cint/evidence-seal/1" && seal.status === "SEALED", "CINT_SEAL_INVALID", "Unsupported evidence seal");
    assertCint(seal.issuer_id === this.issuer_id, "CINT_SEAL_ISSUER_MISMATCH", "Evidence seal issuer mismatch");
    for (const field of ["receipt_digest", "consumption_digest", "revalidation_digest", "outcome_digest", "ledger_head_digest", "signature"]) {
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
