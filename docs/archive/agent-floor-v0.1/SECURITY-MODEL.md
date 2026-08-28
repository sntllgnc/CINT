# Historical Agent Floor security model

## Objective

Agent Floor reduces four risks in delegated Codex execution:

1. inherited context that is irrelevant, sensitive, or incorrectly attributed;
2. authority expansion beyond explicitly granted files;
3. unbounded fan-out, cycles, runtime, or output;
4. admission of unsupported or semantically contradictory findings.

## Trust boundaries

| Boundary | Trusted | Untrusted until verified |
|---|---|---|
| Root task | Explicit task specification and local policy code | Ambient conversation history and undeclared files |
| Child input | Canonical packet and allowlisted projection | User configuration, project rules, memories, plugins, apps, and parent transcript |
| Child execution | Operating-system process controls and observed exit state | Model prose and recommendations |
| Usage | Unique request-local usage records after a verified boundary | Raw cumulative counters and replayed events |
| Evidence | Reopened file, exact line/excerpt, source hash, and parent semantic assertions | Citation strings supplied by the worker |

## Mechanical protections

- `fork_turns="all"` is rejected before execution.
- A new ephemeral Codex process is created; no resume identifier is accepted.
- User configuration and project rules are ignored for the child.
- The child receives only allowlisted files in a temporary read-only projection.
- The Codex process receives an explicit runtime environment allowlist instead of the complete parent environment.
- Worker shells retain default filtering and add exclusions for common secret-bearing variable names.
- Child multi-agent fan-out is disabled and depth is zero inside the worker.
- Concurrency, cycles, runtime, and output are monitored by the parent process.
- Original sources are re-hashed before admission.
- Final output must satisfy a JSON schema and parent-owned semantic assertions.

## Local data handling

Agent Floor executes locally and uses the existing local Codex authentication surface. It does not read, copy, rewrite, export, or publish credential files. Raw native logs remain local and are excluded from the public package.

The published telemetry fixtures are synthetic and sanitized. They preserve only the numerical shape needed to test boundary accounting. The published native proof is a redacted summary containing aggregate usage, control state, evidence references, and hashes.

## Threats not eliminated

- A malicious or compromised local Codex executable can misreport events or ignore flags.
- The operating system and repository owner remain trusted.
- On platforms where the read-only sandbox permits other host-readable files, use a container, virtual machine, or dedicated account for hostile source content.
- Environment exclusions reduce accidental secret propagation; they are not hostile-code containment or a network firewall.
- Post-response token admission cannot stop provider-side work already completed.
- Exact file-line verification cannot establish broader factual truth by itself; semantic assertions reduce but do not eliminate that risk.
- Read-only AF-G0 does not govern a later write phase unless that phase receives a separate explicit policy and authority grant.

## Security verification

The publication gate runs tests, deterministic demonstration, dependency audit, local secret/path/name scan, hidden-metadata inspection, and fresh-clone verification. See `SECURITY.md` for reporting vulnerabilities.
