# SI1 CINT

**Machine Counterintelligence Runtime**

> No consequential action without current authority.

CINT prevents silent, stale, replayed, or unauthorized intent from becoming
machine action. It reconstructs the requested intent, resolves the principal
and authority, challenges current policy and machine state, and emits one of
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

## R0 state

`CINT-R0` is an architecture-accepted public review candidate on
`cint-r0-reassembly`. Its source is publicly exposed through the review branch
and draft pull request. The default branch remains the legacy Agent Floor
product, and no merge, public release, package publication, repository rename,
or external announcement is authorized.

| Public state | Value |
|---|---|
| Source exposure | Yes — review branch and draft pull request |
| Default product | No — `main` remains legacy Agent Floor |
| Release | No |

Remote review is enforced by a pinned GitHub Actions matrix covering the
declared Node.js 20 compatibility boundary, Node.js 24 LTS, current Node.js 26,
and Linux, macOS, and Windows. The stable aggregate gate is
`CINT-R0 remote verification`.

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

```sh
npm ci
npm test
npm run cint:identity
npm run verify
```

The historical `npm run demo` remains available as the AF-G0 Adapter 01
regression. It is not the CINT product definition.

## Repository map

```text
src/cint/                         adapter-independent CINT core and execution boundary
src/cint/adapters/                explicit, separately imported R0 action adapters
src/adapters/codex-delegation/    preserved Agent Floor compatibility kernel
schemas/cint/                     strict authority-bearing JSON schemas
tests/cint-*.test.js              CINT conformance and end-to-end proofs
docs/cint-r0/                     gate evidence and local review packet
docs/archive/                     historical Agent Floor and competition material
artifacts/cint-r0/                gate ledger and sanitized gate receipts
```

## Design and review

- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY-MODEL.md)
- [Threat model](docs/THREAT-MODEL.md)
- [Privacy](docs/PRIVACY.md)
- [Limitations](docs/LIMITATIONS.md)
- [Codex Adapter 01](docs/CODEX-ADAPTER.md)
- [CINT-R0 gate ledger](artifacts/cint-r0/gate-ledger.json)
- [Local release-candidate state](docs/RELEASE.md)

The immutable Agent Floor baseline remains the tagged release
`v0.1.0-af-g0`. Its narrative, evaluation material, media, fixtures, protocols,
and evidence remain available as historical lineage and regression proof.

## Licence and contribution

Code, documentation, schemas, and sanitized fixtures are licensed under
[Apache-2.0](LICENSE). Contribution and conduct requirements are in
[CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md),
and [AGENTS.md](AGENTS.md). Security reports follow [SECURITY.md](SECURITY.md).
