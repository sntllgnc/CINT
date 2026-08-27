# CINT Adapter 01 — Codex delegation

Codex delegation is one action type beneath CINT. The adapter preserves the
Agent Floor v0.1 clean-context and evidence kernel while removing its ability to
define final authority.

## Preserved controls

- strict task validation and `fork_turns="all"` rejection;
- clean self-contained packet and source manifest;
- allowlisted temporary source projection;
- ephemeral read-only Codex process;
- disabled nested fan-out and nonessential product features;
- restricted process and shell environment inheritance;
- cycle, runtime, output, concurrency, and request-local token controls;
- deduplicated request-local usage accounting;
- exact path, line, excerpt, source-hash, and semantic evidence checks.

## New CINT boundary

The adapter action binds the canonical legacy packet digest and a safe task
digest. The CINT core independently requires:

1. explicit read-only delegation intent;
2. current principal, exact authority grant, policy, adapter capability, and
   machine-state decision;
3. signed one-shot receipt;
4. immediate revalidation and consumption;
5. a second event-bound revalidation before side-effect-free preparation;
6. a third execution-bound revalidation after preparation;
7. legacy execution and adapter outcome verification;
8. CINT ledger and evidence seal.

The legacy result may be `ADMITTED` or `REJECTED`; both are evidence about the
delegated review. Neither value grants CINT authority. The wrapper exports no
decision, receipt, consumption, self-admission, or seal method.

The original CLI remains available only through `agent-floor` or the explicit
`cint legacy` compatibility command. Importing the CINT core or running
`cint identity` does not load the adapter or legacy CLI.
