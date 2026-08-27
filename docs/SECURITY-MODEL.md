# CINT security model

## Security properties

CINT-R0 enforces these properties for its implemented local adapters:

- explicit intent precedes authority evaluation;
- principal, authority, policy, adapter, target, action, context, and machine
  state remain digest-bound through decision and receipt;
- decisions cannot execute directly;
- only the core receipt authority can authenticate executable authority;
- every receipt expires, revalidates, and reaches one terminal store state;
- replay, substitution, forgery, stale policy, revoked authority, drift, and
  unavailable controls stop before action;
- all 11 public authority-bearing schemas execute at record construction and
  verification boundaries;
- missing adapter or seal verification fails before receipt consumption;
- outcome verification is distinct from execution;
- divergent or interrupted synthetic effects are restored and hash-verified;
- only verified or restored outcomes receive a core evidence seal;
- adapters cannot mint or admit their own authority.

## Enforcement boundaries

| Boundary | Enforcing component |
|---|---|
| Strict JSON, runtime schemas, and record integrity | `src/cint/schema.js` and `src/cint/canonical.js` |
| Exact action scope and time-bound authority | `src/cint/authority.js` |
| Silent request and counter-intent challenge | `src/cint/challenge.js` |
| Zero-authority decision | `src/cint/decision.js` |
| Receipt authentication and lifetime | `src/cint/receipt.js` |
| One-shot state and replay rejection | `src/cint/store.js` |
| Current binding checks | `src/cint/revalidation.js` |
| Fail-closed action boundary | `src/cint/execution.js` |
| Verified/restored terminal outcome | `src/cint/outcome.js` and `src/cint/rollback.js` |
| Hash-chained evidence and terminal authentication | `src/cint/evidence.js` and `src/cint/seal.js` |

## Key custody

Receipt and seal authorities accept caller-supplied key material of at least 32
bytes and retain it in private class fields. Keys do not enter canonical records,
ledger payloads, adapter configuration digests, output artifacts, or errors.
R0 does not persist or distribute keys; the embedding runtime owns generation,
storage, rotation, and process isolation.

## Adapter containment

The synthetic adapter is restricted to a caller-selected disposable root and a
single existing relative regular file. It resolves the target inside that root,
checks the expected pre-action digest, writes atomically, verifies the final
digest, and can restore the exact original bytes.

The Codex adapter preserves the Agent Floor clean-context, allowlisted source
projection, environment filtering, child fan-out prohibition, execution limits,
request-local accounting, and evidence verification. It is classified read-only
and has no CINT authority functions.

## Audit posture

The CINT test corpus contains positive and negative controls for silent requests,
undeclared effects, target scope, missing rollback, record tampering, signature
forgery, expiry, concurrent replay, crash locks, policy drift before and after
consumption, target drift, unavailable services, divergence, interrupt,
rollback restoration, evidence sealing, adapter authority separation, and
legacy packet drift. It also executes the independent-review regressions for a
missing adapter verifier, preparation-time policy and authority drift, invalid
rehashed authority, all 11 schemas, and denied eager Adapter 01 loading.

The publication audit continues to reject local absolute paths, raw logs,
credential formats, email addresses, session identifiers, hidden metadata, and
private project names. The exact public product phrase `SI1 CINT` is the sole
new identity exception.
