# CINT R1 G1 — TypeScript migration and trust map

Baseline: `acc857b5d6fadd363816ad9dbf2fdc710a35ba15`.

Reviewer A ran read-only in a clean, history-free context with
`gpt-5.6-terra`, medium reasoning, no child agents, and the prescribed bounded
scope. Root independently reproduced the cited imports, hashes, status, and
control boundaries before admitting this map.

## Dependency direction

The observed CINT graph is acyclic:

```text
schemas/cint/* -> schema.js
legacy util.js -> canonical.js -> record constructors
schema.js -----^

authority.js --\
policy.js ------> challenge.js -> decision.js
principal.js ---/                    |
intent.js ---------------------------+

canonical.js -> receipt.js -> store.js
challenge.js -> revalidation.js
outcome.js ----\
rollback.js ----> execution.js -> evidence.js + seal.js
revalidation.js/

core -> synthetic adapter
core -> typed Adapter 01 boundary -> legacy codex-delegation kernel
core -> index.js -> cli.js -> bin/cint.js
```

Evidence:

- `src/cint/schema.js:6-42` loads, checks, and compiles the fixed 13-schema
  protocol registry.
- `src/cint/canonical.js:131-175` applies schema validation during sealing and
  protocol-specific verification.
- `src/cint/challenge.js:1-11` depends on authority and policy evaluation;
  `src/cint/decision.js:1-11` depends on challenge, not the reverse.
- `src/cint/execution.js:3-13` depends on canonical validation, outcome,
  revalidation, and rollback.
- `src/cint/index.js:1-19` is the public barrel; it does not initialize adapters.
- `src/cint/cli.js:49-51` loads the legacy CLI only for an explicit `legacy`
  command.

No reverse import may create `canonical <-> schema`, `challenge <-> policy`, or
`execution <-> revalidation` cycles. Adapters remain outside core initialization.

## Trust boundaries

| Boundary | Untrusted input | Runtime authority retained |
|---|---|---|
| Canonical JSON | Text and arbitrary values | JSON-only values, canonical-byte equality, exact digests |
| Protocol admission | Caller-supplied records | Exact protocol and one of the 13 AJV schemas |
| Decision | Intent, principal, authority, policy, capability, machine state, time | Exact keys, schema validation, challenge status |
| Receipt | Decision, issuance time, key material | ADMIT-only issuance, HMAC over canonical bytes, expiry |
| Store | Files, pending receipt, concurrent consumers | Exclusive lock, digest binding, one terminal transition |
| Revalidation | Current snapshots and receipt | Fresh schema checks, digest/epoch/status comparison |
| Execution | Injected clock, store, callbacks, adapter, signals | Capability preflight, consumed receipt, fresh final time |
| Adapter | Prepared and executed records | Output remains untrusted until verification |
| Evidence/seal | Ledger files and outcome records | Hash chain, verified outcome, HMAC seal |
| CLI | `argv` and output sink | Fixed commands; legacy load is explicit and lazy |

The decisive execution ordering is preserved from
`src/cint/execution.js:153-176`, `189-218`, and `231-286`: consume with locked
revalidation, revalidate after consumption, prepare without effect, take a
fresh trusted time, revalidate again, invoke the adapter with no intervening
await, verify its untrusted result, then seal or roll back.

## Mechanical type distinctions

R1 will make these nominal rather than interchangeable strings or objects:

- `CanonicalInstant`, `Sha256Digest`, `ProtocolIdentifier`;
- `PrincipalId`, `AuthorityId`, `PolicyId`, `IntentId`, `DecisionId`,
  `ReceiptId`, `AdapterId`;
- `TargetDigest`, `ActionDigest`, `ContextDigest`;
- `AdmitDecision`, `DenyDecision`, `ReviewDecision`;
- `IssuedDecisionReceipt`, `ConsumedReceiptRecord`, `RejectedReceiptRecord`;
- `ValidRevalidation`, `RevokedRevalidation`, `RejectedRevalidation`,
  `FailClosedRevalidation`;
- `PreparedAction`, untrusted `AdapterExecution`, `VerifiedOutcome`,
  `RestoredOutcome`, and `EvidenceSeal`.

Unknown inputs become typed records only after the same runtime validation that
R0 applies. Legacy `ADMITTED` telemetry is not CINT authority.

## Gate-ordered migration

1. G3 introduces type-only brands, protocol/state unions, adapter contracts,
   negative compile-time tests, and build mechanics. R0 JavaScript remains live.
2. G4 migrates schema/canonical together, then the leaf decision records,
   challenge, and decision.
3. G5 migrates receipt, revalidation, store, and state machine.
4. G6 migrates execution, outcome, rollback, evidence, and seal.
5. G7 migrates the synthetic adapter, typed Adapter 01 bridge, Codex wrapper,
   barrel, CLI, bin, and CINT tests. Package exports switch only here.

Until their named gate, the schemas, canonical serializer, HMAC authorities,
store, execution/revalidation path, evidence/seal path, public exports, CLI, and
legacy adapter kernel remain byte-unchanged.

## Source anchors

The root reproduced these baseline SHA-256 values:

- `src/cint/canonical.js`: `f9f99a1999c617a3049102b190d77ec06bb82750d27d519dde72a43f35fa5765`
- `src/cint/schema.js`: `853a85cd99cb0521dbd0e0424b097e04bc483958deb24915cbfb780ff0ca4bdb`
- `src/cint/execution.js`: `9cdb80a6db392e4a8672d1d25c5898d03411a9754e3ab65413741e789207a716`
- `src/cint/receipt.js`: `f11e5707b8adb25be37945291a91cda29580d60f53a86f8cfce8178c2ad67c95`
- `src/cint/store.js`: `3a8a91a91ec18a4968bae1c69dd5a1be0bab0f01962ff5b3df1bbdf6c7b40249`
- `src/cint/adapters/codex/index.js`: `76dbfc177104b258656356daf0d8bd9f8f90eb61d633241e77011829b6217908`

G1 verdict: `PASS-CINT-R1-G1-A`.
