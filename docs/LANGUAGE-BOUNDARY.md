# CINT language and ownership boundary

## Purpose

Repository language composition and control-plane migration answer different
questions. GitHub reports detected source bytes across the maintained
repository using
[Linguist](https://github.com/github-linguist/linguist), as described in
[GitHub's repository-language documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-repository-languages).
CINT architecture assigns authority by module ownership and runtime admission
controls. A language percentage therefore cannot establish whether a trusted
boundary is complete.

## Main-integration snapshot — 2026-08-28

At merge commit `993ba4ce852eb43a36b2fe4395cdfed33756a7de`, GitHub's language
inventory reported:

| Detected language | Bytes | Share |
|---|---:|---:|
| TypeScript | 226,240 | 59.6% |
| JavaScript | 153,506 | 40.4% |

The percentages are rounded from the detected byte totals. Documentation,
generated output, and vendored dependencies do not define the result. Ignored
`dist/` and `.test-dist/` JavaScript are build products rather than tracked
source.

## Migrated CINT boundary

The production control plane is fully migrated at the source boundary:

| CINT surface | Tracked source state |
|---|---|
| `src/cint/**` | 29 TypeScript files; zero JavaScript files |
| `bin/cint.ts` | TypeScript CLI source |
| `tests/cint-*.test.ts` | Six strict TypeScript conformance suites; zero JavaScript CINT suites |
| `tests/types/**` | Compile-time positive and negative authority contracts |
| `dist/**`, `.test-dist/**` | Ignored emitted JavaScript, declarations, and source maps |

TypeScript does not replace runtime validation. Untrusted records still enter
as `unknown` and must pass exact protocol, schema, canonicalization, digest,
authentication, revalidation, one-shot, trusted-time, outcome, and seal checks.

## Maintained JavaScript ownership

The tracked JavaScript-family inventory contains 43 `.js` or `.mjs` files:

| Top-level surface | Files | Ownership and role |
|---|---:|---|
| `src/**` | 15 | Preserved Agent Floor Adapter 01 plus root compatibility exports and CLI support |
| `scripts/**` | 18 | Build, verification, packaging, audit, and evidence tooling |
| `tests/**` | 8 | Legacy compatibility regressions, package-launch proof, and an adapter-load fixture |
| `fixtures/**` | 1 | Sanitized AF-G0 mock fixture |
| `bin/**` | 1 | Historical `agent-floor` compatibility CLI |

The typed boundary
`src/cint/adapters/codex/legacy-adapter-boundary.ts` is the only deliberate CINT
route into Adapter 01. Adapter evidence cannot become a CINT decision, receipt,
consumption record, or seal.

The JavaScript verification plane can reject a build but cannot grant runtime
authority. Conversely, TypeScript compilation cannot authenticate an untrusted
runtime record. Those separations are architectural, not statistical.

## Linguist policy

CINT does not use `.gitattributes` to relabel or suppress maintained
JavaScript. Changing the displayed percentage without changing the owned source
would obscure the repository boundary and provide no security or correctness
gain.

A future migration of Adapter 01, compatibility modules, tests, or tooling
requires separate authority, preserved behavior, platform proof, and explicit
ownership review. It must not be justified solely by a language-bar target.

## State conclusion

```text
CINT CONTROL PLANE SOURCE       29 TYPESCRIPT / 0 JAVASCRIPT
CINT CONFORMANCE TESTS          6 TYPESCRIPT / 0 JAVASCRIPT
REPOSITORY LANGUAGE SNAPSHOT    59.6% TYPESCRIPT / 40.4% JAVASCRIPT
REMAINING JAVASCRIPT            INTENTIONAL AND OWNED
LINGUIST RECLASSIFICATION       NOT USED
```
