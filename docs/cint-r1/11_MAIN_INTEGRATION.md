# CINT R1 main-integration record

## Record identity

This dated record captures the transition from the accepted R1 branch candidate
to the default-branch source state. It does not replace or rewrite the earlier
C2 acceptance record.

| Field | Value |
|---|---|
| Date | 2026-08-28 |
| Repository | `sntllgnc/CINT` |
| Pull request | [#2](https://github.com/sntllgnc/CINT/pull/2) |
| R0 main parent | `acc857b5d6fadd363816ad9dbf2fdc710a35ba15` |
| Accepted R1 branch head | `b89c263acecec72a0eb802ddeebe78136f0d3b69` |
| True merge commit | `993ba4ce852eb43a36b2fe4395cdfed33756a7de` |
| Merge parents | `acc857b5d6fadd363816ad9dbf2fdc710a35ba15`, `b89c263acecec72a0eb802ddeebe78136f0d3b69` |
| Post-merge workflow | [33179382085](https://github.com/sntllgnc/CINT/actions/runs/33179382085) |
| Workflow result | Nine platform/runtime lanes and both aggregate checks passed |

## State transition

| Stage | Evidence | State established |
|---|---|---|
| C2 implementation acceptance | `97dac5e80609ba6522f15bb5ecc0a4c0aa5ef022`; workflow `33175315187` | Portable package launch accepted; PR #2 still open and draft |
| Documentation reconciliation | `df830bd38940acec427cbf794cba8bf4d8e8800c` | Architecture and C2 evidence recorded without runtime change |
| Temporal correction | `b89c263acecec72a0eb802ddeebe78136f0d3b69` | Historical C2 state separated from live PR state |
| Main integration | `993ba4ce852eb43a36b2fe4395cdfed33756a7de` | PR #2 merged by a true merge commit; complete R1 lineage preserved |
| Post-merge verification | Workflow `33179382085` at `993ba4ce852e…` | Exact merged source passed all nine lanes and both aggregates |

The state machine is:

```text
C2 ACCEPTED CANDIDATE
  -> DOCUMENTATION RECONCILED
  -> REVIEW-READY BRANCH
  -> TRUE MERGE INTO MAIN
  -> POST-MERGE MATRIX PASS
  -> R1 SOURCE INTEGRATED
```

No intermediate acceptance snapshot is promoted into a claim about a later
lifecycle state. In particular, C2's “open and draft” PR status remains correct
only inside its dated historical record.

## Architecture admitted into main

The merged source preserves the R0 decision-bound authority sequence while
changing the maintained CINT implementation language to strict TypeScript:

```text
unknown record
  -> exact runtime schema admission
  -> decision-bound authority
  -> signed one-shot receipt
  -> locked revalidation and consumption
  -> side-effect-free preparation
  -> fresh trusted time and final revalidation
  -> exact adapter execution
  -> outcome verification or rollback
  -> evidence seal
```

The package-launch correction remains in the independent build-assurance plane:

```text
npm CLI metadata present    -> active Node + npm CLI path
metadata absent on Windows  -> fixed command-processor fallback
metadata absent on POSIX    -> direct npm fallback
spawn error or null status  -> fail before JSON parsing
valid zero-status report    -> existing package assertions
```

Build assurance may reject a source state. It cannot issue a decision, receipt,
consumption record, action, or seal.

## Language and ownership state

At main integration, GitHub reported 226,240 TypeScript bytes (59.6%) and
153,506 JavaScript bytes (40.4%). The production CINT boundary itself contains
29 TypeScript and zero JavaScript files under `src/cint/**`; all six CINT test
suites are TypeScript.

The tracked JavaScript belongs to the preserved Adapter 01 and compatibility
surface, build and verification tooling, legacy and package-launch regressions,
and a sanitized fixture. No `.gitattributes` override hides that maintained
source. [`../LANGUAGE-BOUNDARY.md`](../LANGUAGE-BOUNDARY.md) records the complete
ownership interpretation.

## Release and operational boundary

Main integration changes the default source state only. At this record:

- the package remains private;
- the package version remains `0.1.0-cint-r0`;
- `v0.1.0-cint-r0` remains the latest CINT source prerelease;
- `v0.1.0-af-g0` remains the historical Agent Floor release;
- no npm publication occurred;
- no production deployment, machine-wide enforcement, framework migration,
  Rust/WASM work, UI work, or external-service activation occurred.

## Terminal

```text
CINT-R1 SOURCE IN MAIN          INTEGRATED
TRUE MERGE LINEAGE              PRESERVED
POST-MERGE MATRIX               9/9 PASS
AGGREGATE CHECKS                2/2 PASS
R1 PACKAGE RELEASE              NOT PERFORMED
NPM PUBLICATION                 NOT PERFORMED
DEPLOYMENT                      NOT PERFORMED

CINT-R1-MAIN-INTEGRATION-PASS
```
