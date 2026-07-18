# Limitations and non-claims

## Telemetry, billing, and quota

Agent Floor audits local request telemetry. It does not read authoritative account billing data and does not claim that the verified incremental total equals a bill, subscription debit, or quota formula. Cached input is reported separately; the repository does not classify it as free.

The 555.3M fixture demonstrates an attribution defect: a cumulative counter was assigned to a worker despite a much smaller post-boundary increment. It does not prove why any provider-side usage meter changed.

## Token ceilings

The runner evaluates incremental usage after a completed request reports usage. It can reject an over-ceiling result from admission, but cannot guarantee that the provider performed no work beyond the ceiling. Cycle, runtime, and output limits are active process controls; the token ceiling is a post-response admission control.

## Execution environment

The runner depends on the installed Codex executable honoring its documented flags and emitting recognizable JSONL. `npm run doctor` verifies the required command-line surface, not the integrity of the executable or service.

Model identifiers and reasoning tiers are environment-dependent. Policy acceptance means Agent Floor will preserve and record a declared selection; it does not guarantee that every account or Codex build exposes that model or tier.

## Evidence

File-line-excerpt and source-hash verification establishes that cited text exists and remained unchanged. It does not establish that the source itself is true, complete, or authoritative. Parent semantic assertions are task-specific and may be incomplete.

## Authority

AF-G0 is a read-only discovery and admission gate. It does not authorize source modification, deployment, publication, issue creation, messaging, or credential changes. A later action phase needs a separate explicit grant and should consume only admitted evidence.

## Platform scope

The implementation targets Node.js 20+ and the Codex non-interactive command surface verified by `npm run doctor`. Windows path and process behavior have not been validated in AF-G0.
