# CINT-R0 historical baseline seal

The CINT-R0 successor begins from the immutable Agent Floor release object below.

| Field | Sealed value |
|---|---|
| Commit | `d57a80404e04d2c376cba9cc4b3fc06a5d8c8c49` |
| Historical tag | `v0.1.0-af-g0` |
| Historical tests | 14 passed, 0 failed |
| Historical evidence manifest | 53 entries verified |
| Dependency audit | 0 known vulnerabilities |
| Publication audit | Passed |

The tag and commit remain historical proof. CINT work occurs only on the local
successor branch `cint-r0-reassembly`.

## Preserved non-actions

- no push or remote branch creation;
- no change to `main` or `v0.1.0-af-g0`;
- no repository rename, release, package publication, or announcement;
- no action against another repository or live machine state.

## Baseline acceptance

The release commit and tag resolve to the same Git object. The complete required
baseline verification sequence passed before any tracked successor file was
created: dependency installation, test suite, demo, dependency audit,
publication audit, and evidence-manifest verification.
