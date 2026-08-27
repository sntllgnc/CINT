# Contributing

## Development setup

SI1 CINT requires Node.js 20 or newer and has no runtime package dependencies.

```sh
npm ci
npm test
npm run cint:identity
npm run demo
npm run public:audit
```

`npm run demo` is the deterministic historical Adapter 01 regression and makes
no model call. A native Codex adapter run is optional and must be explicitly
authorized by the operator.

## Change discipline

- Preserve the invariant: no consequential action without current
  decision-bound authority.
- Keep decisions non-executable and receipts exact, expiring, one-shot, and
  immediately revalidated.
- Keep adapters unable to decide, issue, consume, self-admit, or seal.
- Keep legacy worker packets self-contained and bounded.
- Never introduce full-history delegation or implicit resume behavior into the
  Codex adapter.
- Preserve the operator-selected root model and reasoning setting.
- Classify each control as policy, mechanical enforcement, telemetry interpretation, or semantic admission.
- Attribute usage from the worker's own boundary; never assign inherited cumulative totals to the worker.
- Add a regression test for every accounting or admission defect.
- Preserve every AF-G0 observable as historical Adapter 01 compatibility.
- Add negative controls for replay, drift, fail-open, verification, and rollback
  changes.

## Public evidence rules

Use synthetic or explicitly sanitized fixtures. Do not commit credentials, email addresses, session identifiers, local absolute paths, raw native logs, private source text, or private project names. Do not make billing or provider-quota claims from local telemetry.

Run the complete local verification before requesting review:

```sh
npm run public:audit
npm audit
npm run evidence:verify
```

## Pull requests

Keep changes scoped. Describe the control boundary changed, the failure mode, the enforcement mechanism, and the verification commands. All tests and publication checks must pass.

Contributions are licensed under Apache-2.0.
