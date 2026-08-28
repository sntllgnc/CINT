# CINT R1 strict TypeScript boundary

## Candidate status

R1 migrates the CINT control plane from JavaScript source to strict TypeScript
source without changing the R0 wire protocols, error codes, canonical bytes,
receipt signatures, execution ordering, or schemas. The package remains private
and versioned `0.1.0-cint-r0` until separate release authority exists.

The exact development toolchain is:

```text
typescript   7.0.2
@types/node  26.4.0
```

Neither package is a runtime dependency.

At C2 acceptance on 2026-08-28, the verified implementation candidate was
`97dac5e80609ba6522f15bb5ecc0a4c0aa5ef022` on `cint-r1-typescript`. It preserved
the C1 parent `42465b0192d167f419e782674fd4675c4049e4d9` and established the
terminal state `READY-FOR-CINT-R1-TYPESCRIPT-REVIEW`. PR #2 was open and draft
at C2 acceptance; that was a reviewable branch state, not a merge or release
state.

Live head, workflow, and review-readiness state are maintained on
[PR #2](https://github.com/sntllgnc/CINT/pull/2) and its GitHub checks.

## Compiler policy

`tsconfig.base.json` sets ES2022 with NodeNext modules and enables every R1
safety option: `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `useUnknownInCatchVariables`,
`noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
`noPropertyAccessFromIndexSignature`, `forceConsistentCasingInFileNames`,
`verbatimModuleSyntax`, `isolatedModules`, `noEmitOnError`, source maps,
declarations, declaration maps, and `skipLibCheck: false`.

The escape-hatch gate rejects production `any`, `as any`, `@ts-ignore`,
`@ts-nocheck`, unchecked double assertions, and non-null assertions. Deliberate
`@ts-expect-error` cases exist only under `tests/types/` to prove invalid
authority substitutions fail compilation.

All six `cint-*.test.ts` suites are included in strict typechecking, compiled
into ignored `.test-dist/` JavaScript, and executed by both `test:cint` and the
complete test path. The candidate contains 29 TypeScript and zero JavaScript
production files under `src/cint/`, and six TypeScript and zero JavaScript CINT
test suites.

## Mechanical distinctions

Branded identities and digests prevent structural substitution between
principals, authorities, policies, decisions, receipts, actions, contexts,
targets, and outcomes. Discriminated unions separate decision, revalidation,
receipt-store, authority, execution, and outcome states. Exhaustive switches
route impossible states through `assertNever`-equivalent checks.

The compile-time suite rejects, among other cases:

- a decision where an issued receipt is required;
- `DENY` or `REVIEW` at receipt issuance;
- an issued receipt as consumed-receipt evidence;
- an outcome digest as an action digest;
- a policy ID as an authority ID;
- unverified adapter output as a verified outcome;
- legacy Agent Floor `ADMITTED` evidence as CINT authority;
- an unknown protocol record used before runtime validation.

## Runtime authority remains unchanged

[TypeScript types are erased](https://www.typescriptlang.org/docs/handbook/typescript-from-scratch)
when JavaScript is emitted. They cannot authenticate or validate an untrusted
record. CINT therefore retains:

- exact protocol and unknown-field rejection;
- all 13 JSON Schema/AJV admission checks;
- canonical JSON and SHA-256 digest verification;
- HMAC receipt and seal verification;
- decision-bound revalidation and atomic one-shot consumption;
- fresh trusted-time checks immediately before execution;
- untrusted adapter-output verification, rollback, and evidence sealing.

Every exported CINT boundary explicitly types its parameters and return value.
Untrusted inputs enter as `unknown` and narrow only through the corresponding
runtime validator.

## Build and compatibility surface

`src/cint/**/*.ts` and `bin/cint.ts` compile to ignored `dist/` JavaScript,
declarations, and source maps. Tests compile to ignored `.test-dist/`. There are
no JavaScript production sources under `src/cint/`.

The historical Agent Floor kernel remains JavaScript under
`src/adapters/codex-delegation/`, the root compatibility modules, and
`bin/agent-floor.js`. CINT can reach that surface only through
`src/cint/adapters/codex/legacy-adapter-boundary.ts`; the legacy result remains
evidence and receives no decision, receipt, consumption, or seal authority.

Package exports resolve compiled JavaScript and declarations for the core,
CLI, synthetic adapter, and Codex delegation adapter. `agent-floor` remains the
historical compatibility CLI.

## Package-launch portability correction

C2 does not change TypeScript types, emitted runtime semantics, protocols,
schemas, exports, or package identity. It changes how the verification process
starts npm:

```text
npm_execpath present    -> process.execPath + npm CLI path, shell false
metadata absent / win   -> fixed cmd.exe invocation, shell false
metadata absent / POSIX -> direct npm invocation, shell false
spawn error or null status -> verification failure before JSON parsing
status 0 + valid report -> continue existing package assertions
```

Six deterministic launch regressions cover those branches. The existing 72
runtime tests, 13 schemas, 18 behavioral-equivalence cases, and 53 historical
evidence entries remain unchanged.
