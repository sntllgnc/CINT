# CINT R1 G9 — independent TypeScript review

Baseline: `acc857b5d6fadd363816ad9dbf2fdc710a35ba15`
Candidate code head: `b549414c4c88682c5e1b56e3a29a8723bfbdb416`
Reviewed at: `2026-08-28T12:40:43Z`

Exactly two fresh, clean-context reviewers ran with `fork_turns=none`,
`gpt-5.6-terra`, medium reasoning, no child agents, read-only source authority,
an eight-cycle ceiling, and a 1,200-word output ceiling. Neither reviewer made a
tracked change or performed a remote write.

## Reviewer C — authority and runtime boundary

Verdict: `ACCEPT-CINT-R1-TYPESCRIPT-CANDIDATE`
Findings: zero.

Reviewer C verified:

- untrusted values remain `unknown` until exact-key, schema, canonical-record,
  digest, protocol, or signature validation (`src/cint/canonical.ts:102-132`,
  `src/cint/canonical.ts:282-321`, `src/cint/schema.ts:108-122`);
- decisions, issued receipts, consumed and rejected store records,
  revalidation states, verified/restored outcomes, and evidence seals are
  distinct (`src/cint/types/records.ts:180-245`,
  `src/cint/types/records.ts:262-399`);
- Adapter 01 declares zero authority operations and its legacy `ADMITTED`
  value remains evidence (`src/cint/adapters/codex/legacy-adapter-boundary.ts:16-23`,
  `src/cint/adapters/codex/index.ts:141-184`);
- the store uses exclusive one-shot locking and terminal records
  (`src/cint/store.ts:167-255`);
- a fresh trusted time and final revalidation immediately precede adapter
  invocation with no intervening await (`src/cint/execution.ts:458-481`);
- the TypeScript escape-hatch and typed legacy-boundary scans pass with zero
  findings;
- the frozen surfaces report 13/13 identical schemas, 24/24 protocol strings,
  103/103 error codes, and 18/18 behavioral-equivalence scenarios.

Reviewer C invoked the existing schema verifier, which regenerated only ignored
build output. Root confirmed zero tracked mutations and independently rebuilt
and re-attested the emitted JavaScript and declarations before acceptance.

## Reviewer D — Node, build, package, and legacy boundary

Verdict: `ACCEPT-CINT-R1-TYPESCRIPT-CANDIDATE`
Findings: zero.

Reviewer D verified:

- the engine expression is exactly `^22.0.0 || ^24.0.0 || ^26.0.0`, Node 24 is
  normative, Node 22 temporary, Node 26 forward, and Node 20 historical only;
- CI is exactly nine OS/runtime lanes and both aggregate checks depend on the
  same complete matrix;
- verification order and process invocation are cross-platform and fail
  closed;
- all four package exports resolve compiled JavaScript and declarations, both
  CLIs resolve correctly, and the package remains private at
  `0.1.0-cint-r0`;
- `dist/`, `.test-dist/`, and `*.tsbuildinfo` are ignored and untracked, and
  source maps contain no private absolute paths;
- core and identity imports do not load Adapter 01; only the explicit legacy
  command crosses its typed lazy boundary;
- the preserved legacy JavaScript remains functional;
- no Three.js, Rust, WASM, React, web-framework, UI, server, browser-bundle, or
  runtime TypeScript dependency entered the candidate.

## Root re-attestation

Root independently reproduced every decision-bearing finding:

- Node 24.20.0 full ordered verification: 56/56 compiled CINT tests and 16/16
  legacy tests, 72/72 total;
- 14 compile-time negative contracts, 30-file escape-hatch scan, and 29-file
  import-boundary scan: pass with zero findings;
- R0 parity harness: 18/18 scenarios and artifact verification pass;
- schemas: 13/13 bytes identical; protocols: 24/24 identical; error codes:
  103/103 identical;
- independently emitted JavaScript and declarations match `dist/` exactly;
  packaged source maps use relative sources and disclose zero private paths;
- `src/cint/`: 29 TypeScript files and zero JavaScript files;
- preserved Agent Floor JavaScript and historical R0/archive documents are
  unchanged from the accepted base;
- dependency audit: zero vulnerabilities; publication audit: zero findings;
  AF-G0 evidence: 53/53; package exports and declarations: 4/4 each;
- package dependencies are only AJV/AJV Formats at runtime and exact-pinned
  TypeScript 7.0.2 plus `@types/node` 26.4.0 for development.

No finding weakens an earlier gate. No schema, protocol, error, canonical byte,
HMAC input, authority order, one-shot state, trusted-time boundary, legacy
behavior, or framework boundary changed.

## Verdict

`ACCEPT-CINT-R1-TYPESCRIPT-CANDIDATE`
