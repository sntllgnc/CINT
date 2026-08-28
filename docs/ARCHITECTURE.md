# CINT architecture

## Governing invariant

No consequential action occurs without current decision-bound authority.

CINT separates interpretation, authority, execution, and evidence. A request is
not authority. An `ADMIT` decision is not authority. A signed receipt becomes
executable only after immediate revalidation and atomic one-shot consumption.

## R1 source and runtime boundary

R1 expresses the CINT control plane in strict TypeScript and emits JavaScript,
declarations, and source maps into ignored `dist/` output. TypeScript types are
erased during compilation. They make invalid state substitutions fail during
development, but they do not validate a runtime value or confer execution
authority.

Every external record therefore begins as `unknown` and crosses the same R0
runtime controls: exact keys, one of the 13 unchanged JSON Schemas, canonical
JSON, content digests, protocol checks, and the applicable HMAC and gate
verification. Runtime schemas remain authoritative.

## Two assurance planes

CINT keeps runtime authority and build assurance mechanically separate:

| Plane | Establishes | Does not establish |
|---|---|---|
| Runtime authority | Current decision bindings, signed receipt eligibility, one-shot consumption, execution admission, verified outcome, rollback, and evidence seal | Package portability, publication, deployment, or host-wide enforcement |
| Build assurance | Strict compilation, test execution, schema packaging, package inventory, export and declaration resolution, source-map hygiene, and supported-platform verification | A decision, receipt, consumed authority, adapter invocation, or seal |

The package verifier can fail a candidate build. It cannot authorize a CINT
action. Conversely, a valid CINT receipt cannot bypass package, CI, or release
policy.

## Control planes

| Plane | Responsibility | Cannot do |
|---|---|---|
| Canonical | Strict objects, runtime JSON Schema validation, canonical JSON, digests, immutable records | Decide or execute |
| Intent | Reconstruct request, action, target, context, effects, uncertainties | Grant authority |
| Principal and authority | Resolve actor, delegation chain, exact grants, epochs, validity, revocation | Execute an action |
| Policy and challenge | Compare current policy, adapter capability, machine state, and counter-intent | Mint a receipt |
| Decision | Emit `ADMIT`, `DENY`, or `REVIEW`; bind every current digest | Cross the execution boundary |
| Receipt authority | Authenticate an eligible `ADMIT` binding and lifetime | Reconstruct or widen the decision |
| Receipt store | Register, lock, revalidate, consume once, reject replay | Decide policy |
| Execution gate | Preflight every required service, revalidate, consume, prepare, revalidate immediately before invoking the exact adapter | Mint or reinterpret authority |
| Outcome and rollback | Verify final state or restore the pre-action state | Seal itself |
| Ledger and seal | Hash-chain events and authenticate terminal evidence | Authorize another action |

## Decision and execution sequence

1. `createIntent` canonicalizes the explicit request and calculates independent
   intent, action, target, and context digests.
2. Principal resolution and an authority grant establish identity, delegation
   chain, exact adapter/action/target scope, epoch, and lifetime.
3. A policy snapshot and adapter capability establish current allowed actions,
   rollback requirements, and review conditions.
4. The counter-intent challenge denies silent or undeclared effects, mismatched
   principals, unavailable state, stale authority, disallowed targets, and
   incapable adapters. Material uncertainty routes to `REVIEW`.
5. The decision binds every digest and explicitly records
   `execution_authority: NONE`.
6. The receipt authority signs only a receipt-eligible `ADMIT` decision.
7. The store obtains an exclusive receipt lock, invokes immediate revalidation,
   and writes exactly one terminal consumed or rejected record.
8. The execution gate obtains a fresh snapshot, revalidates again, and confirms
   the runtime adapter's exact decision-bound capability before preparation.
9. The selected adapter performs only side-effect-free preparation. That
   property is explicit in the signed adapter capability and is required by the
   decision and execution preflight.
10. The gate obtains a third fresh snapshot after preparation and revalidates
    authority, policy, action, target, context, adapter capability, machine
    state, expiry, and revocation immediately before invoking execution. No
    asynchronous operation occurs between that check and invocation.
11. The adapter checks current target state and performs only the receipt-bound
    action.
12. Outcome verification either confirms the intended final digest or invokes
    rollback. Only verified or demonstrably restored outcomes can be sealed.

## Atomicity and failure posture

The receipt store uses exclusive file creation for registration, lock, and
terminal records. A concurrent caller, existing terminal record, or ambiguous
lock is rejected. A crash does not trigger guessed lock recovery. The receipt
remains unusable until an explicit higher-authority recovery protocol exists.

Execution fails closed before receipt consumption when the receipt verifier,
store consumer, snapshot provider, adapter preparer/executor/verifier, required
rollback function, ledger, or seal issuer/verifier is unavailable. If failure
occurs after a synthetic action begins, the gate invokes rollback and verifies
the restored hash before sealing the restored outcome.

## Package-verification boundary

Package verification runs the immutable argument vector
`npm pack --dry-run --json --ignore-scripts`. Launch selection is ordered and
fail closed:

1. When `npm_execpath` exists, the verifier invokes it through
   `process.execPath` without a shell.
2. On Windows without npm CLI metadata, it invokes the fixed command through
   `ComSpec` or `cmd.exe` with `/d /s /c`; no untrusted value enters the command
   text.
3. On POSIX without npm CLI metadata, it invokes `npm` directly without a
   shell.
4. A spawn error, `status: null`, non-zero status, malformed JSON, unexpected
   report cardinality, or missing file inventory terminates verification.
5. Only a successful report proceeds to package-target, runtime-export,
   declaration-export, source-map, and private-package assertions.

This boundary is implemented in `scripts/npm-pack-launch.mjs` and consumed by
`scripts/verify-package.mjs`. Its deterministic regression is independent of
the six compiled CINT test suites.

## Adapter boundary

Adapters implement preparation, execution, outcome verification, and optional
rollback. Preparation is contractually side-effect-free and its declaration is
decision-bound; the final core revalidation detects bound-state drift introduced
during preparation. Adapters receive no receipt or seal key. They cannot resolve
principals, change authority, issue decisions, consume receipts, or seal
outcomes through the adapter interface.

The TypeScript core entrypoint, `src/cint/index.ts`, imports no action adapter or
legacy Agent Floor CLI. Package consumers resolve compiled JavaScript and
declarations under `dist/`. Adapters are available only through explicit
subpath entrypoints. The `cint legacy` command loads Adapter 01 lazily through
the typed boundary after explicit invocation.

The Codex delegation adapter binds the preserved Agent Floor packet and task
digests, then executes the existing clean, bounded, read-only runner. Its
historical `ADMITTED/REJECTED` field is adapter evidence, not CINT authority.

## Persistence

- CINT records are canonical immutable JSON objects with content digests.
- Receipt-store filenames are hashes of receipt identifiers.
- Ledger entries contain payload digests and the preceding entry digest.
- Evidence seals authenticate the receipt, consumption, revalidation, outcome,
  and ledger head.
- Operational receipt keys, seal keys, absolute adapter paths, and raw action
  bytes are never embedded in receipts or seals.

## Historical compatibility

The original policy, packet, audit, admission, and runner implementations live
under `src/adapters/codex-delegation/`. Root module re-exports and the
`agent-floor` CLI retain the frozen API and AF-G0 regression semantics. The
historical tag and evidence manifest remain the source of immutable release
identity.

## C2 acceptance snapshot — 2026-08-28

At C2 acceptance, the reviewed candidate head was
`97dac5e80609ba6522f15bb5ecc0a4c0aa5ef022`. Workflow `33175315187` had passed
Linux, macOS, and Windows on Node.js 22, 24, and 26, plus both aggregate checks.
The branch was ready for TypeScript review, and PR #2 was open and draft at C2
acceptance. `main` remained the R0 baseline, and no merge, release, package
publication, framework migration, or deployment followed from that state.

Live head, workflow, and review-readiness state are maintained on
[PR #2](https://github.com/sntllgnc/CINT/pull/2) and its GitHub checks.
