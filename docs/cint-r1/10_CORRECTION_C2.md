# CINT R1 C2 — state, logic, and architecture

This record supersedes no historical gate document. It appends the final
package-launch correction state to the R1 candidate lineage.

## C2 acceptance snapshot — 2026-08-28

| Field | Value |
|---|---|
| Repository | `sntllgnc/CINT` |
| Base | `main` at `acc857b5d6fadd363816ad9dbf2fdc710a35ba15` |
| Branch | `cint-r1-typescript` |
| Pre-C1 candidate | `4338955d41749146da36f714a0e0182b9f4bb32e` |
| C1 | `42465b0192d167f419e782674fd4675c4049e4d9` |
| C2 | `97dac5e80609ba6522f15bb5ecc0a4c0aa5ef022` |
| Pull request at C2 acceptance | [#2](https://github.com/sntllgnc/CINT/pull/2); it was open and draft at C2 acceptance |
| Nonqualifying C1 run | `33173883181`, preserved and not rerun |
| Qualifying C2 run | [33175315187](https://github.com/sntllgnc/CINT/actions/runs/33175315187) |
| Terminal | `READY-FOR-CINT-R1-TYPESCRIPT-REVIEW` |

At C2 acceptance, the terminal meant the branch satisfied the bounded
TypeScript review gate. It did not mean merged, released, published, deployed,
or production-ready. Live head, workflow, and review-readiness state are
maintained on [PR #2](https://github.com/sntllgnc/CINT/pull/2) and its GitHub
checks.

## Corrected contradiction

C1 completed the line-ending-independent workflow checks and migrated all six
CINT test suites to strict TypeScript. Its remote run then exposed a distinct
package-verification failure on Windows:

```text
build and package checks reached
-> spawnSync("npm.cmd", fixed pack arguments)
-> process status = null
-> package verification cannot establish a normal npm result
```

The defect belonged to process launch, not package contents, TypeScript output,
runtime authority, schemas, protocols, or historical behavior.

## Design invariant

Package verification admits output only after a process has started without a
spawn error and returned an ordinary zero exit status.

```text
spawn error       -> FAIL
status null       -> FAIL
status non-zero   -> FAIL
status zero       -> parse JSON
invalid JSON      -> FAIL
wrong report form -> FAIL
valid report      -> verify package inventory and exports
```

`status: null` is not collapsed into an ordinary non-zero result. It represents
an indeterminate launch or signal state and fails before JSON parsing.

## Launch-selection logic

The immutable package request remains:

```text
npm pack --dry-run --json --ignore-scripts
```

Selection is deterministic:

| Condition | Command boundary | Shell |
|---|---|---|
| `npm_execpath` is present | `process.execPath`, then npm CLI path and fixed arguments | `false` |
| npm metadata absent on Windows | `ComSpec` or `cmd.exe`, then `/d /s /c` and one fixed command | `false` |
| npm metadata absent on POSIX | `npm` with the fixed arguments | `false` |

The preferred path avoids platform-specific executable-wrapper behavior. The
Windows fallback uses only fixed verifier-owned text. No request, package
field, path from an untrusted record, or adapter result enters its command.

## Package-assurance sequence

```text
deterministic launch regression
-> strict build
-> select npm invocation
-> require a determinate successful process result
-> parse exactly one JSON pack report
-> require its file inventory
-> match every declared bin, types, and export target
-> resolve four compiled runtime exports
-> typecheck the declaration consumer
-> reject private absolute paths in source maps
-> require package private = true
-> PASS
```

This sequence is a build-assurance gate. It issues no CINT decision, receipt,
consumption record, verified outcome, or seal.

## Runtime architecture preserved

C2 changes none of the CINT authority sequence:

```text
unknown input
-> runtime schema and canonical admission
-> principal, authority, policy, capability, and machine-state challenge
-> ADMIT / DENY / REVIEW with execution_authority = NONE
-> authenticated one-shot receipt
-> locked revalidation and atomic consumption
-> side-effect-free preparation
-> fresh trusted time and final revalidation
-> exact adapter invocation
-> untrusted outcome verification
-> verified seal or verified rollback
```

The TypeScript compiler makes authority states and identities mechanically
distinct during development. Emitted JavaScript plus the 13 runtime schemas,
canonical digests, HMAC checks, receipt store, trusted-time revalidation, and
adapter verifiers remain the runtime enforcement surface.

## Verification receipt

Local final proof:

- package-launch regressions: 6/6;
- existing runtime tests: 72/72;
- CINT test suites: 6 TypeScript / 0 JavaScript;
- production CINT: 29 TypeScript / 0 JavaScript;
- schemas: 13/13 with unchanged hashes;
- behavioral equivalence: 18/18;
- AF-G0 evidence: 53/53;
- dependency vulnerabilities and publication findings: 0/0;
- runtime and declaration exports: 4/4 each;
- generated output: ignored and untracked;
- independent correction review: `ACCEPT-CINT-R1-CORRECTION`.

Remote final proof:

- Ubuntu 24.04 on Node.js 22, 24, and 26: pass;
- macOS 26 on Node.js 22, 24, and 26: pass;
- Windows 2025 on Node.js 22, 24, and 26: pass;
- `CINT-R0 remote verification`: pass;
- `CINT-R1 TypeScript verification`: pass.

## Remaining gate

The candidate is ready for R1 TypeScript review. The following remain outside
this state:

- PR ready conversion and merge;
- direct `main` mutation;
- tag, release, or npm publication;
- production or machine-wide deployment;
- Rust, WASM, Three.js, browser, UI, or visualization work;
- any rewrite of Agent Floor or the immutable R0 evidence lineage.
