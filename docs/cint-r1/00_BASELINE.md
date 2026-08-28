# CINT R1 G0 — admitted public baseline

Recorded at `2026-08-28T11:38:52Z`.

## Authority admission

- Task: `CINT-R1-TYPESCRIPT-CONTROL-PLANE`
- Repository: `sntllgnc/CINT`
- Public base: `main`
- Accepted base: `acc857b5d6fadd363816ad9dbf2fdc710a35ba15`
- Base tree: `e156a3a150152961ff3aa027ceb69b9f97f3c780`
- R1 branch: `cint-r1-typescript`
- Package version held at `0.1.0-cint-r0`

The external C3 receipt `CINT-R0-PUBLIC-CUTOVER-C3.json` was admitted only
after its SHA-256 sidecar verified. The receipt is 8,551 bytes, has SHA-256
`de0e948d9650f0b1f1d4d43910950cb4d428991c407244f7386a1679a442fc63`,
parses as JSON, states `r1_precondition: SATISFIED`, and terminates
`CINT-R0-PUBLIC-CUTOVER-PASS`.

## Public identity

Read-only live verification established:

- public repository and default branch: `sntllgnc/CINT`, `main`;
- live `refs/heads/main`: `acc857b5d6fadd363816ad9dbf2fdc710a35ba15`;
- `v0.1.0-cint-r0^{}`: `acc857b5d6fadd363816ad9dbf2fdc710a35ba15`;
- `v0.1.0-af-g0^{}`: `d57a80404e04d2c376cba9cc4b3fc06a5d8c8c49`;
- both release refs are annotated tags;
- main workflow run `33131135677` completed successfully at the accepted base;
- the source worktree was clean before R1 branch creation.

## R0 verification before branch creation

The frozen lockfile was installed before Node runtime checks. On the available
local R0 runtime (`node v25.9.0`, `npm 11.12.1`):

- `npm ci`: PASS, 0 vulnerabilities;
- `npm run verify`: PASS, 72/72 tests;
- AF-G0 deterministic demo: PASS;
- AF-G0 evidence manifest: 53/53;
- publication audit: PASS, 0 findings;
- dependency audit: 0 vulnerabilities;
- `npm run schema:verify`: PASS, 13/13 schemas.

This local R0 execution is baseline evidence, not an R1 support claim. R1
support is separately gated on Node 22, 24, and 26.

## Frozen boundary

The 13 authoritative schema hashes are recorded in
`artifacts/cint-r1/schema-sha256.json`. Any byte change requires
`HOLD-CINT-R1-SCHEMA-CHANGE`.

The upstream runtime-policy basis is the Node.js release table: Node 20 is EOL,
Node 22 and Node 24 are LTS, and Node 26 is Current as of this admission. The
TypeScript basis is its erased compile-time type model; runtime schemas remain
authoritative. Three.js describes itself as a browser-facing 3D/WebGL library
and has no place in the trusted CINT runtime.

## G0 verdict

`PASS-CINT-R1-G0`

No main write, push, tag, release, merge, npm publication, deployment, schema
change, framework migration, Rust, WASM, Three.js, or UI action occurred.
