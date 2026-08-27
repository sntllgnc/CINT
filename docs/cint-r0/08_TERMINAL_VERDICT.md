# CINT-R0 terminal verdict

```text
READY-FOR-CINT-REVIEW
```

## Gate ledger

| Gate | Result | Sealed outcome |
|---|---|---|
| CINT-R0.G0 | PASS | Historical baseline frozen |
| CINT-R0.G1 | PASS | Preservation map and archive plan reconciled |
| CINT-R0.G2 | PASS | Legacy modules isolated with behavioral equivalence |
| CINT-R0.G3 | PASS | Canonical contracts and decision engine established |
| CINT-R0.G4 | PASS | Decision receipt and atomic one-shot consumption established |
| CINT-R0.G5 | PASS | Synthetic action, verification, and rollback proved |
| CINT-R0.G6 | PASS | Legacy Codex delegation admitted only as Adapter 01 |
| CINT-R0.G7 | PASS | Product identity and documentation reassembled |
| CINT-R0.G8 | PASS | Independent detached clean-worktree verification passed |

Eight modifying gate commits follow the historical baseline. G0 is the sealed
admission condition and introduces no successor mutation.

## Independent verification evidence

```text
TEST RUNNER                 53 total / 53 pass / 0 fail
CINT JSON SCHEMAS           11 parsed
JSON EVIDENCE OBJECTS       parsed without error
THREAT-MODEL CITATIONS      38 source-bound references
ACTIVE DOCUMENTS            10 present
README LOCAL LINKS          13 resolved
NPM AUDIT                   0 vulnerabilities
CINT PUBLICATION AUDIT      PASS / 0 findings
HISTORICAL EVIDENCE         PASS / 53 entries
CINT IDENTITY               PASS / publication authority NONE
PACKAGE DRY RUN             PASS
DETACHED WORKTREE           CLEAN
```

The verification subject was checked outside the branch checkout. Syntax,
schemas, evidence JSON, source citations, links, dependencies, all tests, the
historical demo, publication hygiene, historical evidence identity, CINT CLI
identity, package contents, and final cleanliness were independently evaluated.

## Changed-file register

The exact register is the output of:

```text
git diff --name-status d57a80404e04d2c376cba9cc4b3fc06a5d8c8c49..HEAD
```

It contains 102 paths: 76 additions, 21 modifications, and five history-aware
renames. The changes are bounded to the CINT kernel and schemas, Adapter 01
isolation, compatibility shims, conformance tests, active product surfaces,
historical archives, local evidence, and verification tooling.

## Preserved boundary

- `v0.1.0-af-g0` resolves to
  `d57a80404e04d2c376cba9cc4b3fc06a5d8c8c49`.
- local `main` and the locally observed `origin/main` tracking reference remain
  at that baseline.
- the successor exists only on local branch `cint-r0-reassembly`.
- legacy `ADMITTED` remains evidence and cannot issue CINT authority.
- consequential execution requires current decision-bound authority, exclusive
  one-shot receipt consumption, immediate revalidation, verified outcome, and
  seal or rollback.

## Public non-actions

```text
REMOTE PUSH              NONE
PUBLIC BRANCH CREATION   NONE
REPOSITORY RENAME        NONE
RELEASE CREATION         NONE
NPM PUBLICATION          NONE
EXTERNAL ANNOUNCEMENT    NONE
PUBLIC ACTIONS           0
REMOTE MUTATIONS         0
```

These are execution-history facts, not authorization for a later action.

## Resume marker

```text
CINT-R0-FOUNDATION-REASSEMBLY /
LOCAL-BRANCH /
NO-PUSH /
AWAITING-/D.-REVIEW
```
