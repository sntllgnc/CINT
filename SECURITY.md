# Security policy

## Supported line

The public CINT-R0 source prerelease remains the released line. The R1
TypeScript branch is a review candidate, not a release or production baseline.
Security corrections enter `main` only through separately authorized protected
changes. The immutable Agent Floor release remains historical evidence.

The active security baseline is the latest security-patched Node.js 24 release.
Node.js 22 is retained temporarily for compatibility testing, Node.js 26 is a
forward-compatibility lane, and Node.js 20 is historical and unsupported.

Strict TypeScript compilation is a development control only. Runtime security
continues to depend on the unchanged JSON Schema/AJV, exact-key, canonical
digest, HMAC, revalidation, one-shot, trusted-time, outcome, rollback, and seal
checks.

## Report a vulnerability

Use the repository's private vulnerability reporting channel. Include the
affected revision, violated CINT invariant, realistic attacker starting
capability, action or evidence boundary, reproduction steps, impact, and the
smallest sanitized proof required to verify the report.

Do not place credentials, receipt or seal keys, private source, raw Codex logs,
operator requests, local paths, or vulnerability-triggering payloads in a public
issue. If private reporting is unavailable, request a private coordination
channel without vulnerability details.

## Reportable boundaries

- unauthorized decision or receipt issuance;
- receipt forgery, replay, expiry, revocation, or atomic-consumption bypass;
- action, target, context, principal, authority, policy, adapter, or
  machine-state binding bypass;
- fail-open execution when a required CINT component is unavailable;
- synthetic containment, verification, interrupt, or rollback failure;
- evidence-ledger or seal integrity bypass;
- Codex Adapter 01 escape from its read-only source or zero-authority boundary;
- disclosure of signing keys, credentials, private requests, or raw evidence.

## Non-security accounting boundary

Legacy Adapter 01 telemetry is request-local execution evidence. It is not an
account billing total, subscription debit, or provider quota-causation formula.

## Disclosure handling

Reports are reproduced against the smallest safe local fixture, classified by
the affected trust boundary, corrected with negative and positive conformance
evidence, and coordinated before any public disclosure.
