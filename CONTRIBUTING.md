# Contributing

## Development setup

Agent Floor requires Node.js 20 or newer and has no runtime package dependencies.

```sh
npm ci
npm test
npm run demo
npm run public:audit
```

`npm run demo` is deterministic and makes no model call. A native Codex run is optional and must be explicitly intended by the operator.

## Change discipline

- Keep worker packets self-contained and bounded.
- Never introduce full-history delegation or implicit resume behavior.
- Preserve the operator-selected root model and reasoning setting.
- Classify each control as policy, mechanical enforcement, telemetry interpretation, or semantic admission.
- Attribute usage from the worker's own boundary; never assign inherited cumulative totals to the worker.
- Add a regression test for every accounting or admission defect.
- Keep AF-G0 read-only; mutation requires a separate authority design.

## Public evidence rules

Use synthetic or explicitly sanitized fixtures. Do not commit credentials, email addresses, session identifiers, local absolute paths, raw native logs, private source text, or private project names. Do not make billing or provider-quota claims from local telemetry.

Run the publication audit before opening a pull request:

```sh
npm run public:audit
npm audit
```

## Pull requests

Keep changes scoped. Describe the control boundary changed, the failure mode, the enforcement mechanism, and the verification commands. All tests and publication checks must pass.

Contributions are licensed under Apache-2.0.
