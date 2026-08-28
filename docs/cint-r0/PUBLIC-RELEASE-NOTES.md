# SI1 CINT v0.1.0 — R0

## Identity

SI1 CINT is the Machine Counterintelligence Runtime for decision-bound
consequential action. Its public source repository is `sntllgnc/CINT`, and this
source prerelease is `v0.1.0-cint-r0`.

CINT prevents silent, stale, altered, replayed, or unauthorized intent from
becoming consequential machine action.

> No consequential action without current decision-bound authority.

## What R0 proves

R0 establishes strict canonical intent, principal, authority, policy,
machine-state, challenge, decision, receipt, revalidation, execution-result,
outcome, and seal contracts with runtime enforcement of all 13 public schemas.
It demonstrates a local event-bound protocol from decision through controlled
action, outcome verification, rollback, and evidence sealing.

## Decision and receipt boundary

An `ADMIT`, `DENY`, or `REVIEW` decision carries zero executable authority. Only
an `ADMIT` decision may receive an HMAC-authenticated, action-bound, expiring,
one-shot receipt. The receipt binds the decision, action, target, context,
principal, authority and policy epochs, adapter, and machine state. Consumption
is atomic on one compatible local filesystem; replay and ambiguous locks fail
closed.

## Trusted-time execution revalidation

R0 revalidates authority, policy, machine state, receipt state, and expiry while
the receipt is locked, after consumption, and again with fresh trusted time
immediately before consequential execution. A receipt that expires during
preparation cannot cross the execution boundary.

## Adapters

- The synthetic file-patch adapter proves a disposable existing-file mutation,
  exact outcome verification, interrupt handling, rollback, and byte restoration.
- Agent Floor remains CINT Adapter 01 for read-only delegated coding-agent
  review. It cannot decide, issue or consume receipts, self-admit, or seal CINT
  evidence.

## Verification

The release baseline passes 72/72 automated tests, enforces 13/13 runtime
schemas, and preserves 53/53 historical AF-G0 evidence entries. Dependency audit
reports zero vulnerabilities, and the publication audit reports zero findings.
The required `CINT-R0 remote verification` matrix covers Linux, macOS, and
Windows on Node.js 20, 24, and 26.

## Historical Agent Floor lineage

The complete Agent Floor lineage remains preserved. Historical tag
`v0.1.0-af-g0` and its GitHub release are unchanged, and its compatibility CLI
remains available as `agent-floor` alongside the primary `cint` CLI.

## Limitations and non-claims

This prerelease is a local protocol and proof runtime. It is not a production
authorization service, operating-system enforcement layer, distributed
consensus service, hostile-adapter sandbox, machine-wide integrity mechanism, or
physical autonomous-system controller. It assumes a trusted embedding process,
correct execution-time clock, protected HMAC key custody, and a compatible local
filesystem. Revalidation is event-bound rather than continuous. No npm
publication, production deployment, or third-party operational reliance is
authorized or claimed.

## Licence

Code, documentation, schemas, and sanitized fixtures are licensed under the
Apache License 2.0. Trademark rights are not granted by that licence.
