# Changelog

## v0.1.0-cint-r0 — 2026-08-28

- Made SI1 CINT and `sntllgnc/CINT` the active repository and default-source
  identity.
- Closed architecture findings F1-F5 at accepted architecture commit
  `1343b88e1b95c8e299a8bfa7d3b0786d8347c8c4`.
- Closed `CINT-EXPIRY-001` through trusted execution-time revalidation at
  `ae3502779c97ae44464714fea25e1868d5ecaa1d`.
- Passed 72/72 automated tests before the publication-state commit and in final
  publication verification.
- Enforced all 13/13 public runtime schemas and preserved AF-G0 evidence at
  53/53.
- Passed remote verification on Linux, macOS, and Windows across Node.js 20, 24,
  and 26.
- Preserved Agent Floor as CINT Adapter 01 and the historical
  `v0.1.0-af-g0` release lineage.
- Published the source as a GitHub prerelease without npm publication or a
  production-readiness claim.

## v0.1.0-af-g0 — 2026-07-18

- Added clean, self-contained child packets with explicit lineage and authority.
- Added mechanical rejection of `fork_turns="all"`.
- Added bounded ephemeral Codex execution with disabled child fan-out.
- Added process-environment allowlisting and worker-shell secret-name exclusions.
- Added request-local usage auditing with duplicate-event removal.
- Added deterministic file-line-excerpt, source-hash, and semantic admission.
- Added the sanitized 555.3M versus 1,492,621 accounting regression.
- Added a contradictory-conclusion negative control using valid citations.
- Added 14 automated tests, deterministic demonstration, native redacted summary, publication audit, and evidence manifest.
