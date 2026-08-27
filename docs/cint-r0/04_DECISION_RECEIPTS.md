# CINT-R0 decision receipts and one-shot store

An `ADMIT` decision can now be transformed into an executable-authority
candidate only by the CINT receipt authority. `DENY` and `REVIEW` decisions are
cryptographically ineligible.

## Receipt binding

Each receipt is HMAC-SHA256 authenticated and carries the exact decision digest,
decision lifetime, nonce, and the admitted binding:

- intent, action, target, and context digests;
- principal digest;
- authority identifier, digest, and epoch;
- policy identifier, digest, and epoch;
- adapter identifier and capability digest;
- machine-state identifier, digest, and epoch.

Changing any field, recomputing the public record digest, or substituting a
different issuer fails verification. The signing key never enters the receipt.

## Atomic consumption protocol

The file-backed receipt store uses a hashed receipt identifier and four isolated
states: `pending`, `locks`, `consumed`, and `rejected`.

```text
register with exclusive create
  -> acquire exclusive receipt lock
  -> compare presented and registered receipt digests
  -> run immediate revalidation while holding the lock
  -> write terminal consumed or rejected record with exclusive create
  -> remove pending record
  -> release lock
```

Only one concurrent consumer can acquire the lock. A consumed, rejected, or
already locked receipt returns `CINT_RECEIPT_REPLAY_REJECTED`. Crash residue is
not guessed away; an ambiguous lock remains `LOCKED` and therefore fail closed.
Expired or revalidation-revoked receipts move to the terminal rejected state.

## Gate proof

- receipt issuance from non-`ADMIT` decisions is rejected;
- exact binding and signature verification passes;
- rehashed binding forgery and expiry are rejected;
- registered receipts consume once and reject replay;
- two concurrent consumers produce exactly one success;
- a substituted receipt with the same identifier is rejected;
- failed revalidation and expiry become terminal rejection;
- crash-lock ambiguity remains fail closed;
- all 28 earlier CINT and legacy tests remain green.

No adapter is given the receipt key or store authority. Consequential execution
remains absent until the next gate.
