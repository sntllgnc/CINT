# CINT limitations and non-claims

- R1 TypeScript types provide compile-time contract visibility only. They are
  erased from emitted JavaScript and never replace runtime schema validation,
  exact-key rejection, canonical digests, HMAC verification, revalidation,
  one-shot consumption, or trusted-time checks.

- R0 is a local protocol and proof runtime, not a distributed authorization
  service.
- Receipt and seal key generation, persistence, rotation, and hardware
  protection belong to the trusted embedding process. R0 also trusts that
  process to supply a correct execution-time clock.
- File-backed receipt consumption is atomic on one compatible local filesystem;
  cross-host consensus and network filesystems are not established.
- Ambiguous locks fail closed. R0 deliberately provides no automatic stale-lock
  deletion or recovery authority.
- Revalidation is event-bound, not continuous at every CPU instruction. Future
  adapters that touch concurrent external systems need an adapter-specific
  transaction or conditional-write mechanism.
- Adapter capability records require preparation to be side-effect-free, and
  the core revalidates after preparation. CINT trusts the selected in-process
  adapter implementation to honor that contract; it does not sandbox hostile
  adapter code or prove the absence of unrelated side effects.
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
- Node.js 24 is the normative runtime major. Node.js 22 is a temporary
  compatibility lane, Node.js 26 is a forward-compatibility lane, and Node.js
  20 is historical only. Support for a major still requires its latest
  security-patched release.
- The cross-platform `npm pack --dry-run` proof establishes launch portability,
  expected package inventory, export/declaration resolution, and source-map
  hygiene. It is not an npm publication, clean-install guarantee, deployment
  proof, signature-transparency proof, or production-readiness claim.
- GitHub's language bar measures detected bytes across the complete maintained
  repository. The 59.6% TypeScript / 40.4% JavaScript snapshot is not an
  authority, trust, coverage, or migration-completeness metric. The CINT
  control plane under `src/cint/**` contains 29 TypeScript and zero JavaScript
  source files; the remaining JavaScript belongs to documented adapter,
  compatibility, tooling, test, and fixture surfaces.
- PR #2 integrating the R1 TypeScript source into `main` does not itself create
  an R1 release. The package remains private and versioned `0.1.0-cint-r0`;
  tags, GitHub releases, npm publication, and deployment require separate
  authority.
- R1 contains no Rust, WASM, Three.js, browser, WebGL, web-server, or UI trusted
  runtime. An isolated Rust core and any visualization surface require separate
  future authority; neither is implied by this migration.
- `v0.1.0-cint-r0` is a public source prerelease. It does not authorize npm
  publication, production deployment, third-party operational reliance,
  machine-wide enforcement, or physical autonomous action.

The AF-G0 accounting case remains a historical Adapter 01 regression. It does
not define CINT and does not establish a provider bill or quota formula.
