# CINT-R0 remote review-candidate state

## Identity

| Field | Value |
|---|---|
| Product code | `CINT` |
| Public display | `SI1 CINT` |
| Descriptor | Machine Counterintelligence Runtime |
| Invariant | No consequential action without current decision-bound authority |
| Branch | `cint-r0-reassembly` |
| Baseline | `v0.1.0-af-g0` at `d57a80404e04d2c376cba9cc4b3fc06a5d8c8c49` |
| Accepted architecture | `1343b88e1b95c8e299a8bfa7d3b0786d8347c8c4` |
| State | Remote review candidate |
| Public source exposure | Yes |
| Public default product | No — `main` remains legacy Agent Floor |
| Public release | No |

## Local candidate contents

- strict canonical contracts and runtime enforcement of all 13 public schemas;
- principal, authority, policy, challenge, and decision engine;
- signed action-bound one-shot receipts;
- atomic consumption, replay rejection, expiry, and revocation;
- receipt-locked, pre-preparation, and execution-bound revalidation with
  fail-closed dependency preflight;
- synthetic action, verification, interrupt, rollback, ledger, and seal;
- preserved Agent Floor foundation as Codex Adapter 01;
- gate-by-gate local commits and evidence artifacts.

## Remote verification

Every pull-request head must pass `CINT-R0 remote verification`. The aggregate
gate covers the complete verification command and the 13-schema package check
on Linux, macOS, and Windows across Node.js 20, 24, and 26.

## Publication boundary

The source branch and draft pull request are public. That exposure does not
authorize merge, default-product cutover, tag, release, package publication,
repository rename, media action, or external announcement. The historical tag,
default branch, and public Agent Floor release remain immutable until a separate
authority decides otherwise.
