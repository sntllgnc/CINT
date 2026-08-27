# CINT-R0 limitations and non-claims

- R0 is a local protocol and proof runtime, not a distributed authorization
  service.
- Receipt and seal key generation, persistence, rotation, and hardware
  protection belong to the embedding process.
- File-backed receipt consumption is atomic on one compatible local filesystem;
  cross-host consensus and network filesystems are not established.
- Ambiguous locks fail closed. R0 deliberately provides no automatic stale-lock
  deletion or recovery authority.
- Revalidation is event-bound, not continuous at every CPU instruction. Future
  adapters that touch concurrent external systems need an adapter-specific
  transaction or conditional-write mechanism.
- The synthetic adapter proves one disposable existing-file mutation. It does
  not authorize mutation of another repository or live machine state.
- The Codex adapter is read-only toward its source projection. Its output
  directory is writable local evidence state and requires operator review before
  sharing.
- Adapter outcome verification is only as strong as the adapter-specific
  verifier. R0 supplies exact byte verification for the synthetic proof and
  packet/task/run binding for the legacy Codex adapter.
- HMAC receipts and seals establish integrity under secret-key custody; they are
  not public-key attestations or provider-side execution proofs.
- CINT does not establish account billing, provider quota causation, hostile-code
  containment, operating-system integrity, or protection after receipt/seal key
  compromise.
- `CINT-R0` carries no push, publication, release, repository rename, package
  publication, or external announcement authority.

The AF-G0 accounting case remains a historical Adapter 01 regression. It does
not define CINT and does not establish a provider bill or quota formula.
