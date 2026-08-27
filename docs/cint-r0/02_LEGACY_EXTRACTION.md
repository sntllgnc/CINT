# CINT-R0 legacy extraction

The verified Agent Floor implementation now resides under
`src/adapters/codex-delegation/`. Historical root imports remain as thin
re-export shims, so the CLI, examples, tests, and downstream imports keep their
existing behavior.

## Module map

| Historical surface | Adapter implementation | Compatibility surface |
|---|---|---|
| Policy validation | `src/adapters/codex-delegation/policy.js` | `src/policy.js` |
| Packet and lineage | `src/adapters/codex-delegation/packet.js` | `src/packet.js` |
| Request-local audit | `src/adapters/codex-delegation/audit.js` | `src/audit.js` |
| Evidence verification | `src/adapters/codex-delegation/admission.js` | `src/admission.js` |
| Ephemeral execution | `src/adapters/codex-delegation/runner.js` | `src/runner.js` |

`src/adapters/codex-delegation/index.js` is the explicit Adapter 01 boundary.
It declares that the adapter cannot mint a decision, issue or consume a receipt,
self-admit, bypass revalidation, or seal an outcome.

## Behavioral-equivalence proof

- all 14 frozen AF-G0 tests pass unchanged;
- the historical demo produces the same admitted regression record;
- direct adapter exports and root compatibility exports are reference-equal;
- all legacy protocol strings, observable error codes, and runtime controls
  remain in the moved implementations;
- the immutable `v0.1.0-af-g0` evidence manifest still verifies all 53 release
  entries from the historical Git object.

No CINT decision or execution authority is introduced at this gate.
