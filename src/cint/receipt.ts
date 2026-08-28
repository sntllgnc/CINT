import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import {
  assertCint,
  assertExactKeys,
  assertJsonValue,
  boundedString,
  canonicalJson,
  canonicalDigest,
  identifier,
  isPlainRecord,
  isoInstant,
  sealRecord,
  sha256Digest,
  verifyProtocolRecord
} from "./canonical.js";
import type {
  HmacSha256Signature,
  Identifier,
  ReceiptId
} from "./types/brands.js";
import type {
  AdmitDecision,
  IssuedDecisionReceipt
} from "./types/records.js";
import type { JsonObject } from "./types/protocols.js";

function unsignedReceipt(receipt: IssuedDecisionReceipt): JsonObject {
  const unsigned = assertJsonValue(Object.fromEntries(
    Object.entries(receipt).filter(([key]) => key !== "digest" && key !== "signature")
  ), "unsigned receipt");
  assertCint(isPlainRecord(unsigned), "CINT_OBJECT_INVALID", "Unsigned receipt must be an object");
  return unsigned;
}

export interface ReceiptVerificationOptions {
  readonly now?: unknown;
}

export interface ReceiptIssuanceInput {
  readonly decision: AdmitDecision;
  readonly issued_at: unknown;
  readonly id?: unknown;
  readonly nonce?: unknown;
}

export class DecisionReceiptAuthority {
  readonly issuer_id: Identifier;
  #key: Buffer;

  constructor(value: unknown) {
    const input = assertExactKeys(value, ["issuer_id", "key"], [], "receipt authority");
    this.issuer_id = identifier<Identifier>(input["issuer_id"], "receipt authority issuer_id");
    const rawKey = input["key"];
    const key = Buffer.isBuffer(rawKey) ? Buffer.from(rawKey) : Buffer.from(String(rawKey), "utf8");
    assertCint(key.byteLength >= 32, "CINT_RECEIPT_KEY_INVALID", "Receipt authority key must contain at least 32 bytes");
    this.#key = key;
    Object.freeze(this);
  }

  #sign(value: unknown): HmacSha256Signature {
    return sha256Digest<HmacSha256Signature>(
      createHmac("sha256", this.#key).update(canonicalJson(assertJsonValue(value))).digest("hex"),
      "receipt signature"
    );
  }

  issue(input: ReceiptIssuanceInput): IssuedDecisionReceipt;
  issue(value: unknown): IssuedDecisionReceipt {
    const input = assertExactKeys(value, ["decision", "issued_at"], ["id", "nonce"], "receipt issuance");
    const decision = verifyProtocolRecord(input["decision"], "cint/decision/1", "decision");
    assertCint(
      decision.status === "ADMIT" && decision.receipt_eligible,
      "CINT_RECEIPT_DECISION_INELIGIBLE",
      "Only a receipt-eligible ADMIT decision can produce a receipt"
    );
    const admitDecision: AdmitDecision = decision;
    const issuedAt = isoInstant(input["issued_at"], "receipt issued_at");
    assertCint(Date.parse(issuedAt) >= Date.parse(admitDecision.issued_at), "CINT_RECEIPT_TIME", "Receipt issuance precedes its decision");
    assertCint(Date.parse(issuedAt) < Date.parse(admitDecision.expires_at), "CINT_RECEIPT_EXPIRED", "Decision expired before receipt issuance");
    const unsigned = {
      protocol: "cint/decision-receipt/1" as const,
      id: identifier<ReceiptId>(input["id"] ?? `receipt.${randomUUID()}`, "receipt.id"),
      issuer_id: this.issuer_id,
      decision_id: admitDecision.id,
      decision_digest: admitDecision.digest,
      status: "ISSUED" as const,
      issued_at: issuedAt,
      expires_at: admitDecision.expires_at,
      nonce: boundedString(input["nonce"] ?? randomUUID(), "receipt.nonce", { minimum: 16, maximum: 128 }),
      binding: admitDecision.binding,
      binding_digest: admitDecision.binding_digest,
      signature_algorithm: "HMAC-SHA256" as const
    };
    return sealRecord({ ...unsigned, signature: this.#sign(unsigned) });
  }

  verify(value: unknown, options: ReceiptVerificationOptions = {}): IssuedDecisionReceipt {
    const receipt = verifyProtocolRecord(value, "cint/decision-receipt/1", "receipt");
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
