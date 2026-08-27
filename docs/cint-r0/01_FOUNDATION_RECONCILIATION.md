# CINT-R0 foundation reconciliation

## Root decision

Agent Floor is preserved as **CINT Adapter 01 — Delegated Coding-Agent
Execution**. Its verified controls remain useful, but its packet and admission
records are not CINT decision authority. The CINT core alone will resolve the
principal, evaluate current authority and policy, issue an action-bound receipt,
consume it once, revalidate immediately before execution, and seal or roll back
the outcome.

## Preserve, reframe, archive, replace

| Disposition | Surface | Decision and evidence |
|---|---|---|
| Preserve | Canonical JSON, hashing, safe paths, atomic JSON | Shared boundary primitives remain behaviorally compatible (`src/util.js:13-127`). |
| Preserve | Task validation and clean delegation | Retain every AF-G0 limit and error meaning (`src/policy.js:6-16`, `src/policy.js:81-175`). |
| Preserve | Packet, lineage, source manifest | Retain as the adapter request envelope, never as executable authority (`src/packet.js:7-90`). |
| Preserve | Ephemeral Codex runner | Retain as a read-only action adapter with its existing process controls (`src/runner.js:198-258`, `src/runner.js:376-501`). |
| Preserve | Request-local accounting | Retain as legacy adapter telemetry, separate from CINT authorization (`src/audit.js:53-208`). |
| Preserve | Evidence and semantic verification | Retain as adapter outcome evidence offered to CINT (`src/admission.js:84-205`). |
| Preserve | Tests, sanitized fixtures, release artifacts | Keep the historical 14-test regression and exact AF-G0 proof values. |
| Reframe | Active product identity | SI1 CINT is the product; Agent Floor becomes Adapter 01. |
| Archive | Build Week, judge, video, and competition narrative | Retain as historical documentation, outside the active product surface. |
| Replace | Parent-controlled final admission | CINT decisions and one-shot receipts become the only authority for consequential action. |

## Historical compatibility contract

The following observables cannot change during extraction:

- `agent-floor/1`, `agent-floor/run/1`, and `agent-floor/admission/1` protocol
  records;
- every exported legacy function and every `AF_*` error code;
- clean context, `fork_turns="none"`, depth one, read-only execution, and child
  fan-out prohibition;
- packet limit 8 KiB, concurrency two, cycles six, runtime 600 seconds, output
  32 KiB, request-local token ceiling 2,000,000, and 32 allowed paths;
- the AF-G0 sanitized totals: 555,300,000 raw cumulative tokens; 1,492,621
  request-local tokens; 1,380,352 cached input; 103,132 fresh input; 9,137
  output; 16 calls; one duplicate removed;
- source-hash, path, line, exact-excerpt, semantic, and runtime rejection behavior.

## Confirmed CINT gaps

| Priority | Gap | Consequence |
|---|---|---|
| P0 | No principal or external decision-bound authority | A valid local task spec currently proceeds directly to child execution. |
| P0 | No signed, expiring, action/target/context-bound receipt | A packet hash cannot grant or prove one-shot authority. |
| P0 | No atomic receipt consumption or replay state | The legacy protocol cannot prove exactly-once authorization. |
| P0 | Adapter creates its packet and returns `ADMITTED` | Legacy verification is incorrectly positioned as final authority (`src/admission.js:184-205`). |
| P1 | Source drift is checked after child execution | Current authority, policy, target, and machine state are not revalidated at the action boundary (`src/admission.js:122-140`). |
| P1 | No fail-closed action adapter, interrupt, outcome, or rollback contract | Divergent consequential outcomes cannot be contained and sealed. |

## Threat boundary

Realistic starting capabilities include a principal proposing an overbroad but
well-formed action, hostile content inside an allowed source, a changed local
policy or machine state, and a replayed or modified receipt. CINT must deny any
new capability unless all current bindings survive revalidation. A compromised
operator account, operating system, or CINT signing authority is not treated as
an attacker starting condition for R0.

The existing documentation assigns packet creation and final admission to Agent
Floor (`docs/THREAT-MODEL.md:14-19`). That remains true for the frozen release,
but the active CINT architecture must place those records below the CINT
decision boundary.

## Sequential extraction order

1. Move legacy implementations behind adapter modules while retaining root
   compatibility re-exports.
2. Add strict CINT canonical objects and schemas without granting execution.
3. Add principal, authority, policy, challenge, and decision protocols.
4. Add signed decision receipts and durable one-shot consumption.
5. Add immediate revalidation, fail-closed execution, outcome verification,
   interrupt, rollback, evidence seal, and ledger.
6. Integrate the preserved Codex adapter only as a CINT action adapter.
7. Replace the active documentation surface and run independent terminal
   verification.

