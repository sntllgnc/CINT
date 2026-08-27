# CINT Adapter 01 — delegated coding-agent execution

The frozen Agent Floor kernel is now integrated beneath CINT as a read-only
action adapter. Its clean packet, source manifest, ephemeral process,
request-local telemetry, and evidence checks remain intact.

## Authority separation

The adapter exposes only:

- an exact `CODEX_DELEGATED_REVIEW` action constructor;
- a packet/task binding check;
- bounded legacy execution;
- an outcome verifier.

It exposes no CINT decision, receipt issuance, receipt consumption, outcome
seal, or self-admission operation. Every declared authority-boundary flag is
false.

The historical `agent-floor/admission/1` record remains unchanged for
compatibility. Its `ADMITTED` or `REJECTED` value is now adapter evidence only.
It cannot authorize execution and cannot become a CINT terminal verdict.

## Binding

The CINT intent binds both:

- the canonical legacy packet SHA-256 digest; and
- a safe task digest covering the worker, admission policy, delegation limits,
  and a digest of the repository boundary.

The adapter recomputes both after receipt consumption and before launching the
legacy runner. Drift stops before Codex execution.

## Gate proof

- the wrapper exposes no CINT authority methods;
- one mock-backed clean delegated review runs through decision, receipt,
  revalidation, one-shot consumption, legacy execution, outcome verification,
  ledger, and evidence seal;
- the preserved legacy result remains `ADMITTED`, while CINT independently
  returns a sealed verified outcome;
- changed legacy packet/task material is rejected before the child process;
- all 48 prior CINT and legacy tests remain green.

Agent delegation is therefore one governed action type. It no longer defines
the product or controls its own authority.
