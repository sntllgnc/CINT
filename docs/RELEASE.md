# SI1 CINT v0.1.0 — R0 source release

## Identity

| Field | Value |
|---|---|
| Product code | CINT |
| Public display | SI1 CINT |
| Repository | `sntllgnc/CINT` |
| Default branch | `main` |
| Release | `v0.1.0-cint-r0` |
| Historical baseline | `v0.1.0-af-g0` |
| Accepted architecture | `1343b88e1b95c8e299a8bfa7d3b0786d8347c8c4` |
| Trusted-time correction | `ae3502779c97ae44464714fea25e1868d5ecaa1d` |
| State | Public R0 source and verification baseline |
| Production readiness | Not claimed |
| npm publication | Not performed |

## R0 contents

- strict canonical contracts and runtime enforcement of all 13 public schemas;
- principal, authority, policy, challenge, and decision engine;
- signed action-bound one-shot receipts;
- atomic consumption, replay rejection, expiry, and revocation;
- receipt-locked, pre-preparation, and execution-bound revalidation with
  fail-closed dependency preflight;
- synthetic action, verification, interrupt, rollback, ledger, and seal;
- preserved Agent Floor foundation as Codex Adapter 01;
- gate-by-gate commits and sanitized evidence artifacts.

## Remote verification

Every protected `main` update must pass `CINT-R0 remote verification`. The aggregate
gate covers the complete verification command and the 13-schema package check
on Linux, macOS, and Windows across Node.js 22, 24, and 26.

## Release boundary

`v0.1.0-cint-r0` is the public source prerelease. It does not claim production
readiness and does not publish `@sntllgnc/cint` to npm. It grants no authority
for production deployment, third-party operational reliance, media action, or
physical autonomous action. The historical `v0.1.0-af-g0` tag and Agent Floor
release remain unchanged.

The complete technical limitations and non-claims are maintained in
[`docs/LIMITATIONS.md`](LIMITATIONS.md).

## R1 successor candidate

The R1 TypeScript candidate is not part of the R0 release. Its verified C2
implementation head is `97dac5e80609ba6522f15bb5ecc0a4c0aa5ef022`, and workflow
[33175315187](https://github.com/sntllgnc/CINT/actions/runs/33175315187)
passed all nine platform/runtime lanes and both aggregate checks. PR #2 remains
open and draft. This establishes `READY-FOR-CINT-R1-TYPESCRIPT-REVIEW`; it does
not alter `main`, either release tag, the prerelease, npm, or deployment state.
