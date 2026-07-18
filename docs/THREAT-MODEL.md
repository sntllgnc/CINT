# Threat model

## Protected assets

- parent task history and unrelated account context;
- repositories and files outside the declared allowlist;
- host credentials and environment variables;
- execution budget and operator-selected reasoning authority;
- integrity of evidence and request-local usage attribution;
- source repository write state.

## Trust boundaries

1. The root operator authors the task specification and admission policy.
2. Agent Floor validates the specification and creates a canonical packet.
3. Allowlisted files are copied into a temporary projection.
4. Codex executes as an ephemeral read-only child with an allowlisted process environment.
5. Worker output remains untrusted until deterministic admission completes.
6. Native event and output files remain sensitive local artifacts.

## Threats and controls

| Threat | Control | Residual risk |
|---|---|---|
| Complete parent history inherited by a child | Fresh process; no resume path; `fork_turns="none"` required | An operator can still place excessive context in the bounded packet |
| Recursive agent fan-out | Multi-agent features disabled; child depth zero; concurrency lock | Codex behavior can change; verify the installed command surface |
| Runaway resource use | Cycle, runtime, output, concurrency, and admission token ceilings | Usage may occur before completed telemetry is available |
| Cumulative telemetry assigned as child usage | Request-local events or explicit post-boundary deltas; duplicate fingerprinting | Local telemetry does not establish provider billing |
| Hallucinated citation | Path, line, excerpt, source hash, and allowlist checks | A real line can still be interpreted incorrectly |
| True citation with a false conclusion | Parent status, finding-code, required/forbidden-term, and evidence-count rules | Semantic rules are task-specific |
| Source changes after worker read | Source hashes rechecked before admission | External systems referenced by a file remain outside AF-G0 |
| Secret-bearing environment exposed | Process allowlist; shell secret-name exclusions; no shell profile | Explicit operator allowlisting can reintroduce sensitive values |
| Source-repository mutation | Temporary copy plus read-only sandbox | Agent Floor writes its own records to the selected output directory |
| Prompt injection in inspected source | Bounded instructions, read-only mode, schema, and parent admission | Host-readable files can remain visible on some platforms; isolate hostile content in a container or virtual machine |
| Network exfiltration | Network-capable product features disabled where exposed | This is not a network firewall; platform behavior must be verified independently |

## Explicit non-claims

Agent Floor does not provide billing reconciliation, cryptographic proof of provider-side execution, hostile-code containment, protection from a compromised executable or operating system, safe handling of secrets deliberately included in a packet, or write-capable remediation at AF-G0.
