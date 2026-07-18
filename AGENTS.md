# Agent instructions

These instructions apply to the entire repository.

## Delegation

- Do not spawn a worker unless the operator explicitly requests delegation or parallel work.
- Never inherit complete conversation history. Use clean context with `fork_turns="none"` and a self-contained packet no larger than 8 KiB.
- Keep delegation depth at one, child fan-out disabled, concurrency at two or less, and a worker to no more than six model/tool cycles or ten minutes.
- Bound the objective, repository root, allowlisted paths, authority, expected output, and stop condition before execution.

## Reasoning authority

- Preserve the operator-selected root model and reasoning effort, including `high`, `xhigh`, `ultra`, or `max` when the environment exposes them.
- Apply efficiency controls to child context, fan-out, cycles, and exploration. Do not silently reduce root reasoning depth.
- Record the actual worker model and reasoning setting in the packet and verification record.

## Accounting integrity

- Measure a worker from its own-turn boundary using unique request-local usage records.
- Separate input, cached input, fresh input, output, reasoning output, and total incremental tokens.
- Treat cumulative counters as diagnostic telemetry until lineage and reset boundaries are verified.
- Never present local telemetry as an account billing total or provider quota formula.

## Evidence admission

- Treat model output as untrusted until the parent verifies status, finding code, semantic assertions, repository-relative file, one-based line, exact excerpt, source hash, execution state, and usage bounds.
- A real citation does not admit a contradictory conclusion.
- AF-G0 is read-only. Do not modify the inspected repository under a discovery grant.

## Verification

Run before handoff:

```sh
npm ci
npm test
npm run demo
npm audit
npm run public:audit
npm run evidence:verify
```

Do not commit generated runtime records under `artifacts/generated/` or `artifacts/runs/`.
