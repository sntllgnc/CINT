# Historical Codex adoption

This guide applies Agent Floor's controls to another Codex task without inheriting the development task that produced Agent Floor.

## Canonical bounded instruction

Give a fresh Codex task this instruction:

```text
Read the Agent Floor adoption guide from:
https://github.com/sntllgnc/agent-floor

Apply its clean-context, fan-out, runtime, incremental-accounting,
and evidence-admission rules to this task.

Do not inherit complete conversation history.
Do not modify operator reasoning settings.
Return the resulting worker policy and verification record.
```

The instruction names a public policy source. It does not authorize repository writes, external publication, credential access, or delegation by itself.

## Required adoption record

Before a worker starts, return or persist a record with:

```json
{
  "context": {
    "mode": "clean",
    "fork_turns": "none",
    "inherited_turns": 0
  },
  "lineage": {
    "parent": "<root-task-id>",
    "child": "<bounded-worker-id>",
    "depth": 1
  },
  "authority": {
    "repository_boundary": "<declared-root>",
    "allowlisted_files": ["<relative-path>"]
  },
  "limits": {
    "max_concurrency": 2,
    "max_cycles": 6,
    "max_runtime_seconds": 600,
    "max_output_bytes": 8192,
    "max_incremental_tokens": "<declared-ceiling>"
  },
  "operator_reasoning": "preserved",
  "usage_accounting": "request-local",
  "evidence_admission": "parent-controlled"
}
```

Replace placeholders with bounded task-specific values. Never copy a complete transcript into the packet.

## Policy controls

Policy controls state what the child may receive and consume:

- exact objective and stop condition;
- repository boundary and allowlisted paths;
- explicit model and operator-selected reasoning setting;
- clean context and zero inherited turns;
- one-level root-to-child depth;
- concurrency, cycle, runtime, output, and incremental-token admission ceilings;
- required output schema and evidence rules.

Policy declaration alone is not enforcement. The verification record must say which controls were mechanically applied.

## Mechanically enforced controls

For Agent Floor's runner, verify:

- a new ephemeral process was created;
- no resume or full-history fork was used;
- ambient configuration and project instructions were excluded;
- only allowlisted source files were projected;
- the child sandbox was read-only;
- child fan-out was disabled;
- cycle, runtime, output, and process-status monitors completed without violation.

When another environment cannot enforce a control mechanically, mark it `POLICY_ONLY`; do not report it as enforced.

## Telemetry interpretation

For each worker, start accounting at its own-turn boundary:

- deduplicate repeated usage payloads;
- sum unique `last_token_usage` records after the boundary, or current `turn.completed.usage` records;
- report input, cached input, fresh input, output, reasoning output, and total incremental tokens separately;
- compare the request-local sum with the cumulative delta when both exist;
- retain cumulative totals as diagnostic telemetry only;
- make no account billing or quota-causation claim from local telemetry alone.

Never attribute a child's inherited `total_token_usage` to the child.

## Semantic evidence admission

Treat worker prose as a candidate result. The parent must verify:

- allowed execution status and finding code;
- required and forbidden semantic terms;
- minimum evidence count;
- allowlisted repository-relative path;
- existing one-based line;
- exact excerpt match;
- unchanged source SHA-256;
- usage and runtime bounds.

Reject the entire candidate when any mandatory check fails. A real citation does not rescue a contradictory conclusion.

## Operator reasoning authority

Do not lower the root task's selected reasoning setting for token economy. Apply efficiency controls to worker context, fan-out, task packets, and exploration bounds. Record the worker model and reasoning setting actually used.

## Verification record

Return both:

1. the worker policy decided before execution;
2. the post-execution verification record containing lineage, context mode, enforcement results, request-local usage, evidence hashes, admission result, and rejection reasons if any.

The deterministic example in `artifacts/af-g0.json` is the canonical public shape.
