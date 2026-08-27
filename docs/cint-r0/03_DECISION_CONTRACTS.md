# CINT-R0 canonical contracts and decision engine

SI1 CINT now has strict, digest-bound objects for intent, principal, authority,
policy, adapter capability, machine state, counter-intent challenge, decision,
and lifecycle state. Unknown fields, non-JSON values, invalid canonical times,
and tampered record digests fail before adjudication.

## Decision chain

```text
explicit request
  -> canonical intent and exact action/target/context digests
  -> authenticated principal and authority chain
  -> active authority, exact grant, time window, and policy binding
  -> policy and adapter capability challenge
  -> current machine-state binding
  -> ADMIT / DENY / REVIEW
```

An `ADMIT` decision is only receipt-eligible. Every decision states
`execution_authority: NONE`; no decision object can itself cross the execution
boundary.

## Counter-intent matrix

| Condition | Decision |
|---|---|
| Exact current principal, authority, policy, target, action, adapter, and machine-state bindings | `ADMIT` |
| Missing explicit request | `DENY / CINT_SILENT_REQUEST` |
| Undeclared effects | `DENY / CINT_EFFECT_UNDECLARED` |
| Target outside the exact grant | `DENY / CINT_AUTHORITY_ACTION_DENIED` |
| CINT state unavailable | `DENY / CINT_UNAVAILABLE` |
| Consequential adapter lacks required rollback | `DENY / CINT_ROLLBACK_REQUIRED` |
| Material uncertainty remains | `REVIEW / CINT_COUNTER_INTENT_UNRESOLVED` |
| Any sealed input was changed | hard rejection before decision |

## Strict schemas

The schema set under `schemas/cint/` uses JSON Schema 2020-12, required fields,
and `additionalProperties: false` for every authority-bearing envelope and
nested binding object. Canonical JSON parsing additionally requires the exact
sorted, whitespace-free byte representation, eliminating duplicate-key and
noncanonical encodings from signed or hashed surfaces.

## Gate proof

- 12 CINT contract and decision tests pass;
- 16 preserved legacy and adapter-boundary tests pass;
- unauthorized target, silent request, undeclared effect, unavailable state,
  missing rollback, tampered record, and overlong decision lifetime controls
  are exercised;
- the state machine rejects undeclared lifecycle transitions;
- historical demo, publication audit, dependency audit, and immutable release
  manifest verification remain green.

Receipt issuance, receipt consumption, and consequential execution remain
absent until later gates.
