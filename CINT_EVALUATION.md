# Independent CINT-R0 remote evaluation

Review draft pull request #1 from `cint-r0-reassembly` into the unchanged legacy
`main`. The accepted architecture commit is
`1343b88e1b95c8e299a8bfa7d3b0786d8347c8c4`. Do not merge, release, rename the
repository, publish a package, or operate unrelated external services.

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
- `cint:identity` reports `REMOTE_R0_REVIEW_CANDIDATE`, public source exposure
  `YES`, public default product `NO`, public release `NO`, and remaining
  publication authority `NONE`;
- `artifacts/cint-r0/gate-ledger.json` contains one ordered pass per completed
  gate;
- Git status is clean after verification;
- the `CINT-R0 remote verification` check passes for Node.js 20, 24, and 26 on
  Linux, macOS, and Windows.

Review the proof matrix in `docs/cint-r0/05_SYNTHETIC_ACTION_PROOF.md`, the
adapter boundary in `docs/cint-r0/06_CODEX_ADAPTER.md`, and the active threat
model before accepting the local candidate for operator review.
