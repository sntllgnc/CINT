# Independent SI1 CINT R0 verification

Verify the public source and verification baseline at `sntllgnc/CINT` on
`main`. The accepted architecture commit is
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
- `cint:identity` reports `PUBLIC_R0_SOURCE`, public source exposure `YES`, public
  default product `YES`, public release `YES`, and remaining publication authority
  `SOURCE_RELEASE_COMPLETE`;
- `artifacts/cint-r0/gate-ledger.json` contains one ordered pass per completed
  gate;
- Git status is clean after verification;
- the `CINT-R0 remote verification` check passes for Node.js 20, 24, and 26 on
  Linux, macOS, and Windows.

Review the proof matrix in `docs/cint-r0/05_SYNTHETIC_ACTION_PROOF.md`, the
adapter boundary in `docs/cint-r0/06_CODEX_ADAPTER.md`, and the active threat
model when evaluating the public R0 source baseline.
