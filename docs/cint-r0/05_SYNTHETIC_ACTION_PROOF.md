# CINT-R0 synthetic consequential-action proof

The first CINT action adapter operates only on a disposable file boundary. Its
single action type, `SYNTHETIC_FILE_PATCH`, binds a relative target, expected
pre-action hash, exact replacement bytes, and consequential classification into
the admitted intent and one-shot receipt.

## Enforced sequence

```text
verify receipt signature and lifetime
  -> lock receipt
  -> resolve current intent, principal, authority, policy, adapter, and state
  -> revalidate every receipt binding
  -> consume receipt once
  -> resolve and revalidate current state again
  -> verify target pre-action hash
  -> execute atomic synthetic patch
  -> verify resulting bytes
  -> seal verified outcome OR restore original bytes and seal rollback
```

The execution ledger is hash-chained. The evidence seal authenticates the
receipt, consumption record, immediate revalidation, verified or restored
outcome, and terminal ledger head. The adapter receives neither receipt nor seal
keys and cannot admit or seal itself.

## Proof matrix

| Vector | Terminal state | Action started | Material result |
|---|---|---:|---|
| Explicit bounded patch | `SEALED` | yes | Declared bytes verified and evidence sealed |
| Silent injected request | `DENY` | no | Receipt ineligible |
| Target outside authority | `DENY` | no | Receipt ineligible |
| Mutation without rollback | `DENY` | no | Receipt ineligible |
| Changed action digest | `REJECTED` | no | Receipt terminally rejected |
| Stale policy before consumption | `REVOKED` | no | Receipt terminally rejected |
| Policy change after consumption | `REVOKED` | no | Consumed receipt cannot act |
| Receipt replay | `REPLAY_REJECTED` | no | No second action |
| Outcome divergence | `ROLLED_BACK` | yes | Original hash restored and sealed |
| In-flight interrupt | `ROLLED_BACK` | yes | Original hash restored and sealed |
| CINT dependency unavailable | `FAIL_CLOSED` | no | Receipt remains pending; target unchanged |
| Target state changed after decision | `FAIL_CLOSED` | no | External bytes preserved; no overwrite |

## Gate proof

- 10 end-to-end synthetic execution tests pass;
- all 38 prior CINT and legacy tests remain green;
- successful, divergent, and interrupted paths produce verifiable evidence
  seals;
- rollback restoration is asserted by the exact original SHA-256 digest;
- the synthetic adapter never reaches another repository or live machine state.
