# SI1 CINT

**Machine Counterintelligence Runtime**

> No consequential action without current decision-bound authority.

CINT prevents silent, stale, altered, replayed, or unauthorized intent from
becoming consequential machine action. It reconstructs the requested intent,
resolves the principal and authority, challenges current policy and machine
state, and emits one of
`ADMIT`, `DENY`, or `REVIEW`. Only an `ADMIT` decision can receive a signed,
action-bound, expiring, one-shot receipt. A decision alone carries no executable
authority.

```text
request
  -> intent
  -> principal + authority
  -> policy + machine-state challenge
  -> ADMIT / DENY / REVIEW
  -> signed one-shot receipt
  -> locked revalidation + atomic receipt consumption
  -> fresh snapshot + side-effect-free adapter preparation
  -> execution-bound revalidation
  -> action adapter
  -> outcome verification
  -> evidence seal or rollback
```

## R1 integrated source state

On 2026-08-28, [PR #2](https://github.com/sntllgnc/CINT/pull/2) merged the
strict TypeScript control plane into `main` through merge commit
`993ba4ce852eb43a36b2fe4395cdfed33756a7de`. The merge preserved the accepted
R0 runtime contracts and the complete R1 correction lineage. The post-merge
[main verification](https://github.com/sntllgnc/CINT/actions/runs/33179382085)
passed all nine Linux, macOS, and Windows lanes on Node.js 22, 24, and 26 plus
both aggregate checks.

`main` is therefore the integrated R1 source state. This is not an R1 release:
the package remains private and versioned `0.1.0-cint-r0`; no R1 tag, GitHub
release, npm publication, production deployment, or machine-wide enforcement
claim exists.

TypeScript makes authority-state and adapter-boundary distinctions visible to
the compiler; it does not become runtime authority. All untrusted records still
enter as `unknown` and must pass the unchanged JSON Schema/AJV, exact-key,
canonical-byte, digest, HMAC, revalidation, one-shot, trusted-time, outcome,
and seal controls.

### C2 acceptance snapshot

The following table preserves the package-launch correction state that preceded
integration:

| Field | Verified value |
|---|---|
| Branch | `cint-r1-typescript` |
| Verified C2 implementation head | `97dac5e80609ba6522f15bb5ecc0a4c0aa5ef022` |
| Required parent | `42465b0192d167f419e782674fd4675c4049e4d9` |
| Pull request at C2 acceptance | [#2](https://github.com/sntllgnc/CINT/pull/2); it was open and draft at C2 acceptance |
| Qualifying C2 workflow | [33175315187](https://github.com/sntllgnc/CINT/actions/runs/33175315187); nine lanes plus both aggregates passed |
| Terminal | `READY-FOR-CINT-R1-TYPESCRIPT-REVIEW` |

The C2 correction changes only package-verification process launch. It prefers
the active Node executable plus npm's CLI path, uses bounded platform fallbacks
when that metadata is absent, and treats spawn errors or a missing exit status
as terminal verification failures. This is build assurance, not CINT execution
authority: it cannot decide, issue or consume a receipt, invoke an action
adapter, or seal an outcome.

## Language composition and ownership

GitHub's language bar measures detected source bytes across the entire
repository. At the R1 main-integration snapshot it reports 226,240 TypeScript
bytes (59.6%) and 153,506 JavaScript bytes (40.4%). Those percentages describe
repository composition—not migration completeness, execution authority, or the
size of the trusted CINT core.

| Surface | Source language | Status |
|---|---|---|
| `src/cint/**` | TypeScript: 29 files; JavaScript: 0 files | Integrated CINT control plane |
| `bin/cint.ts` and six `cint-*.test.ts` suites | TypeScript | CINT CLI and strict conformance tests |
| `src/adapters/codex-delegation/**`, root compatibility modules, `bin/agent-floor.js` | JavaScript | Preserved Agent Floor Adapter 01 and compatibility surface |
| `scripts/*.mjs` | JavaScript | Build, verification, packaging, and evidence tooling |
| Legacy and launcher tests | JavaScript | Historical compatibility and process-launch proofs |

The remaining JavaScript is intentional, maintained, and visible. CINT does not
use `.gitattributes` to disguise it. Future migration of Adapter 01 or tooling
requires separate authority and must preserve historical behavior.

## R0 state

`CINT-R0` is the public source and verification baseline for the SI1 CINT
decision-bound action-control architecture.

The R0 release establishes a local, event-bound execution protocol with
runtime-schema enforcement, decision-bound one-shot receipts, trusted-time
revalidation immediately before consequential execution, outcome verification,
rollback, and evidence sealing.

It is not a production authorization service, operating-system enforcement
layer, distributed consensus service, hostile-adapter sandbox, or physical
autonomous-system controller.

Repository:
https://github.com/sntllgnc/CINT

Release:
v0.1.0-cint-r0

Remote verification:
CINT-R0 remote verification

Remote verification is enforced by a pinned GitHub Actions matrix covering
temporary Node.js 22 compatibility, the normative Node.js 24 LTS baseline,
forward Node.js 26 compatibility, and Linux, macOS, and Windows. The stable
aggregate gates are `CINT-R0 remote verification` and
`CINT-R1 TypeScript verification`; both depend on the same complete matrix.

The R0 proof establishes:

- strict canonical objects and runtime enforcement of all 13 public JSON
  schemas;
- explicit principal, authority, policy, machine-state, and counter-intent
  contracts;
- `ADMIT / DENY / REVIEW` decisions with zero executable authority;
- HMAC-authenticated receipts bound to the exact decision, action, target,
  context, authority epoch, policy epoch, adapter, and machine state;
- file-backed atomic one-shot consumption, replay rejection, expiry, and
  fail-closed crash locks;
- event-bound revalidation inside consumption, after consumption, and again
  after preparation immediately before execution;
- synthetic consequential action, outcome verification, interrupt, rollback,
  hash restoration, execution ledger, and evidence seal;
- Agent Floor imported as **CINT Adapter 01 — Delegated Coding-Agent
  Execution**.

## Adapters

| Adapter | Action | Consequence | Authority |
|---|---|---|---|
| Synthetic file patch | `SYNTHETIC_FILE_PATCH` | Disposable consequential proof | Executes only with a consumed CINT receipt; verifies or restores exact bytes |
| Codex delegation | `CODEX_DELEGATED_REVIEW` | Read-only delegated review | Reports legacy evidence only; cannot decide, issue, consume, admit itself, or seal |

## Verify locally

Use the latest security-patched Node.js 24 release for normative development.
Node.js 22 and 26 are tested compatibility lanes, not the development baseline.

```sh
npm ci
npm run verify
npm run cint:identity
```

The historical `npm run demo` remains available as the AF-G0 Adapter 01
regression. It is not the CINT product definition.

## Repository map

```text
src/cint/**/*.ts                  strict TypeScript CINT control plane
src/cint/adapters/                explicit, separately imported typed action adapters
src/adapters/codex-delegation/    preserved Agent Floor compatibility kernel
schemas/cint/                     strict authority-bearing JSON schemas
tests/cint-*.test.ts              six strictly typed CINT conformance suites
tests/npm-pack-launch.test.mjs    deterministic cross-platform package-launch proof
tests/types/                      compile-time positive and negative contracts
dist/                             ignored generated JavaScript and declarations
docs/cint-r0/                     gate evidence and public R0 release notes
docs/cint-r1/                     R1 gate maps and review evidence
docs/archive/                     historical Agent Floor and competition material
artifacts/cint-r0/                gate ledger and sanitized gate receipts
artifacts/cint-r1/                R1 baseline and behavioral-equivalence records
```

## Design and review

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [Threat model](docs/THREAT-MODEL.md)
- [Privacy](docs/PRIVACY.md)
- [Limitations](docs/LIMITATIONS.md)
- [Runtime support](docs/RUNTIME-SUPPORT.md)
- [TypeScript R1 boundary](docs/TYPESCRIPT-R1.md)
- [Language and ownership boundary](docs/LANGUAGE-BOUNDARY.md)
- [R1 C2 state, logic, and architecture](docs/cint-r1/10_CORRECTION_C2.md)
- [R1 main-integration record](docs/cint-r1/11_MAIN_INTEGRATION.md)
- [Framework boundary](docs/FRAMEWORK-BOUNDARY.md)
- [Codex Adapter 01](docs/CODEX-ADAPTER.md)
- [CINT-R0 gate ledger](artifacts/cint-r0/gate-ledger.json)
- [Historical R0 source release](docs/RELEASE.md)
- [Public release notes](docs/cint-r0/PUBLIC-RELEASE-NOTES.md)

The immutable Agent Floor baseline remains the tagged release
`v0.1.0-af-g0`. Its narrative, evaluation material, media, fixtures, protocols,
and evidence remain available as historical lineage and regression proof.

## Licence and contribution

Code, documentation, schemas, and sanitized fixtures are licensed under
[Apache-2.0](LICENSE). Contribution and conduct requirements are in
[CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md),
and [AGENTS.md](AGENTS.md). Security reports follow [SECURITY.md](SECURITY.md).
