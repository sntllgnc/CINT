# Historical Build Week judge guide

## Fast path

```sh
git clone https://github.com/sntllgnc/agent-floor.git
cd agent-floor
npm ci
npm test
npm run demo
```

Expected proof:

- 14 tests pass;
- `fork_turns="all"` is rejected before execution;
- raw cumulative attribution is 555,300,000 tokens;
- verified request-local usage is 1,492,621 tokens;
- 553,807,379 tokens of false attribution are removed;
- the correction factor is 372.03×;
- the valid evidence result is `ADMITTED`;
- the same real citations attached to a contradictory conclusion are `REJECTED`.

The deterministic path makes no model call and requires no Codex authentication.

## Narrated demonstration: under three minutes

### 0:00–0:25 — Name the defect

“Agent Floor governs Codex delegation before, during, and after execution. The source case looked like a 555.3-million-token worker. That number was a cumulative parent counter inherited through full-history delegation. The verified request-local child usage was 1,492,621 tokens.”

Show:

```sh
npm run doctor
```

Point to `READY` and the required ephemeral, JSONL, structured-output, and clean-configuration flags. Doctor makes no model call.

### 0:25–0:55 — Prove full history cannot start

Run:

```sh
node ./bin/agent-floor.js packet ./examples/rejected-full-history.json
```

Point to `AF_CONTEXT_FULL_HISTORY_FORBIDDEN`. The rejection occurs before model execution.

### 0:55–1:40 — Run the public regression

Run:

```sh
npm run demo
```

Point to:

- `verdict: PASS`;
- `raw_cumulative_tokens: 555300000`;
- `request_local_incremental_tokens: 1492621`;
- `naive_overstatement_tokens: 553807379`;
- `naive_overstatement_factor: 372.03`;
- `duplicate_usage_events_removed: 1`;
- `cumulative_delta_matches_incremental: true`.

Then show the 16-call split: 1,380,352 cached input, 103,132 fresh input, and 9,137 output.

### 1:40–2:15 — Show evidence admission

Open `artifacts/generated/admission.json`. Show `ADMITTED`, then point to:

- `contract.json:809`;
- `negative-conformance-vectors.json:10`;
- the SHA-256 attached to each verified line.

Open `artifacts/generated/semantic-rejection.json`. It uses those same real citations but claims “no conflict”; the parent semantic assertions reject it.

### 2:15–2:45 — Show the execution wrapper

Open `examples/demo-task.json`. Point to clean context, model and reasoning recording, depth one, one worker, six cycles, runtime, output, and token-admission ceiling.

A separately authenticated live run uses:

```sh
node ./bin/agent-floor.js run ./examples/live-smoke-task.json --out ./artifacts/runs/native
```

The wrapper creates a fresh process, replaces inherited instructions, disables child fan-out, projects only allowlisted files, captures request-local JSONL usage, and returns an admission record.

### 2:45–3:00 — Close

“Agent Floor records what authority and context a worker received, what the worker independently found, what that request used, and exactly which evidence entered the parent result.”

## Release audit

```sh
npm run public:audit
npm audit
```

The frozen release records are in `artifacts/af-g0.json`, `artifacts/native-smoke-summary.json`, and `artifacts/evidence-manifest.json`.
