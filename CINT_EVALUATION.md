# Independent CINT-R0 evaluation

Use a clean local checkout of the candidate branch. Do not push, publish,
release, rename, or operate external services.

```sh
npm ci
npm test
npm run cint:identity
npm run verify
```

Require all of the following:

- every test passes with zero failures;
- the historical AF-G0 demo remains reproducible;
- dependency, publication, and immutable historical evidence checks pass;
- `cint:identity` reports `LOCAL_R0_CANDIDATE` and publication authority
  `NONE`;
- `artifacts/cint-r0/gate-ledger.json` contains one ordered pass per completed
  gate;
- Git status is clean after verification;
- the branch has no remote publication side effect.

Review the proof matrix in `docs/cint-r0/05_SYNTHETIC_ACTION_PROOF.md`, the
adapter boundary in `docs/cint-r0/06_CODEX_ADAPTER.md`, and the active threat
model before accepting the local candidate for operator review.
