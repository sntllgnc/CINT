# Independent SI1 CINT current-main verification

Verify the R1-integrated source and retained R0 release baseline at
`sntllgnc/CINT` on `main`. R1 source entered `main` through merge commit
`993ba4ce852eb43a36b2fe4395cdfed33756a7de`; no R1 release followed. The
accepted architecture commit is
`1343b88e1b95c8e299a8bfa7d3b0786d8347c8c4`, and the trusted execution-time
correction is `ae3502779c97ae44464714fea25e1868d5ecaa1d`.

```sh
npm ci
npm test
npm run cint:identity
npm run schema:verify
npm run verify
```

Require all of the following:

- every test passes with zero failures;
- all 13 runtime schemas are registered and present in the package dry run;
- the historical AF-G0 demo remains reproducible;
- dependency, publication, and immutable historical evidence checks pass;
- `cint:identity` reports source state `R1_INTEGRATED_INTO_MAIN`, release state
  `R1_UNRELEASED`, latest public release `v0.1.0-cint-r0`, package version
  `0.1.0-cint-r0`, package private `YES`, and production ready `NO`;
- `artifacts/cint-r0/gate-ledger.json` contains one ordered pass per completed
  gate;
- Git status is clean after verification;
- the `CINT-R0 remote verification` and `CINT-R1 TypeScript verification`
  checks pass over the same Node.js 22, 24, and 26 matrix on Linux, macOS, and
  Windows.

Review the proof matrix in `docs/cint-r0/05_SYNTHETIC_ACTION_PROOF.md`, the
adapter boundary in `docs/cint-r0/06_CODEX_ADAPTER.md`, and the active threat
model when evaluating the current source and release state.
