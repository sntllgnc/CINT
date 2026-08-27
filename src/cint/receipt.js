import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { canonicalJson } from "../util.js";
import {
  assertCint,
  assertExactKeys,
  boundedString,
  canonicalDigest,
  identifier,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifyProtocolRecord
} from "./canonical.js";

function unsignedReceipt(receipt) {
  return Object.fromEntries(
    Object.entries(receipt).filter(([key]) => key !== "digest" && key !== "signature")
  );
}

export class DecisionReceiptAuthority {
  #key;

  constructor(input) {
    assertExactKeys(input, ["issuer_id", "key"], [], "receipt authority");
    this.issuer_id = identifier(input.issuer_id, "receipt authority issuer_id");
    const key = Buffer.isBuffer(input.key) ? Buffer.from(input.key) : Buffer.from(String(input.key), "utf8");
    assertCint(key.byteLength >= 32, "CINT_RECEIPT_KEY_INVALID", "Receipt authority key must contain at least 32 bytes");
    this.#key = key;
    Object.freeze(this);
  }

  #sign(value) {
    return createHmac("sha256", this.#key).update(canonicalJson(value)).digest("hex");
  }

  issue(input) {
    assertExactKeys(input, ["decision", "issued_at"], ["id", "nonce"], "receipt issuance");
    verifyProtocolRecord(input.decision, "cint/decision/1", "decision");
    assertCint(
      input.decision.protocol === "cint/decision/1" && input.decision.status === "ADMIT" && input.decision.receipt_eligible,
      "CINT_RECEIPT_DECISION_INELIGIBLE",
      "Only a receipt-eligible ADMIT decision can produce a receipt"
    );
    const issuedAt = isoInstant(input.issued_at, "receipt issued_at");
    assertCint(Date.parse(issuedAt) >= Date.parse(input.decision.issued_at), "CINT_RECEIPT_TIME", "Receipt issuance precedes its decision");
    assertCint(Date.parse(issuedAt) < Date.parse(input.decision.expires_at), "CINT_RECEIPT_EXPIRED", "Decision expired before receipt issuance");
    const unsigned = {
      protocol: "cint/decision-receipt/1",
      id: identifier(input.id ?? `receipt.${randomUUID()}`, "receipt.id"),
      issuer_id: this.issuer_id,
      decision_id: input.decision.id,
      decision_digest: input.decision.digest,
      status: "ISSUED",
      issued_at: issuedAt,
      expires_at: input.decision.expires_at,
      nonce: boundedString(input.nonce ?? randomUUID(), "receipt.nonce", { minimum: 16, maximum: 128 }),
      binding: input.decision.binding,
      binding_digest: input.decision.binding_digest,
      signature_algorithm: "HMAC-SHA256"
    };
    return sealRecord({ ...unsigned, signature: this.#sign(unsigned) });
  }

  verify(receipt, options = {}) {
    verifyProtocolRecord(receipt, "cint/decision-receipt/1", "receipt");
    assertExactKeys(
      receipt,
      [
        "protocol",
        "id",
        "issuer_id",
        "decision_id",
        "decision_digest",
        "status",
        "issued_at",
        "expires_at",
        "nonce",
        "binding",
        "binding_digest",
        "signature_algorithm",
        "signature",
        "digest"
      ],
      [],
      "receipt"
    );
    assertCint(receipt.protocol === "cint/decision-receipt/1", "CINT_RECEIPT_PROTOCOL", "Unsupported receipt protocol");
    identifier(receipt.id, "receipt.id");
    identifier(receipt.decision_id, "receipt.decision_id");
    assertCint(receipt.issuer_id === this.issuer_id, "CINT_RECEIPT_ISSUER_MISMATCH", "Receipt issuer does not match this authority");
    assertCint(receipt.status === "ISSUED", "CINT_RECEIPT_STATUS", "Receipt is not in ISSUED state");
    isoInstant(receipt.issued_at, "receipt.issued_at");
    isoInstant(receipt.expires_at, "receipt.expires_at");
    boundedString(receipt.nonce, "receipt.nonce", { minimum: 16, maximum: 128 });
    sha256Digest(receipt.decision_digest, "receipt.decision_digest");
    sha256Digest(receipt.binding_digest, "receipt.binding_digest");
    assertCint(
      canonicalDigest(receipt.binding) === receipt.binding_digest,
      "CINT_RECEIPT_BINDING_INVALID",
      "Receipt binding digest is invalid"
    );
    assertCint(receipt.signature_algorithm === "HMAC-SHA256", "CINT_RECEIPT_SIGNATURE_INVALID", "Unsupported receipt signature algorithm");
    sha256Digest(receipt.signature, "receipt.signature");
    const expected = Buffer.from(this.#sign(unsignedReceipt(receipt)), "hex");
    const actual = Buffer.from(receipt.signature, "hex");
    assertCint(
      expected.byteLength === actual.byteLength && timingSafeEqual(expected, actual),
      "CINT_RECEIPT_SIGNATURE_INVALID",
      "Receipt signature is invalid"
    );
    if (options.now !== undefined) {
      const now = isoInstant(options.now, "receipt verification time");
      assertCint(Date.parse(now) < Date.parse(receipt.expires_at), "CINT_RECEIPT_EXPIRED", "Receipt has expired");
    }
    return receipt;
  }
}
