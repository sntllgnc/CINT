# Runtime support

## Normative baseline

SI1 CINT R1 is developed and operated against the latest security-patched
release in the Node.js 24 LTS major. `.nvmrc` and `.node-version` select major
24; they do not freeze an old patch release.

## Tested majors

| Major | Status | Meaning |
|---|---|---|
| Node.js 22 | Temporary compatibility | R1 avoids new behavior unavailable in this lane unless separately accepted. |
| Node.js 24 | Normative LTS baseline | Development and operational reference runtime. |
| Node.js 26 | Forward compatibility | Passing does not make Node 26 normative before later authority. |
| Node.js 20 | Historical only | EOL, rejected by active engines, absent from active CI and security support. |

The supported/tested major identifies a compatibility lane. Deployments and
development environments must still track the latest security-patched release
within that major.

The package engine policy is:

```text
^22.0.0 || ^24.0.0 || ^26.0.0
```

`engine-strict=true` makes unsupported majors a package-install failure.

The policy follows the official [Node.js release table](https://nodejs.org/en/about/previous-releases).
Historical release notes, frozen evidence, and archived Agent Floor material
retain their original runtime statements as immutable history rather than
active support claims.

## Source language and runtime language

The integrated CINT control plane is authored as strict TypeScript under
`src/cint/**`: 29 TypeScript files and zero JavaScript source files. Node.js
executes the ignored JavaScript emitted into `dist/`. That emitted output is a
build product, not a second maintained implementation and not part of GitHub's
tracked source-language calculation.

Tracked JavaScript remains in the preserved Agent Floor Adapter 01,
compatibility entrypoints, build and verification scripts, legacy regressions,
the package-launch regression, and a sanitized fixture. Those files explain
the repository's visible JavaScript share; they do not weaken the strict
TypeScript boundary of `src/cint/**` or create an alternate CINT authority
path. See [`LANGUAGE-BOUNDARY.md`](LANGUAGE-BOUNDARY.md).

## Portable npm process contract

Package verification must not depend on direct `.cmd` execution behavior.
When npm exposes `npm_execpath`, CINT launches that CLI with the active Node
executable on every platform. If the metadata is absent, Windows uses a fixed
command-processor invocation and POSIX uses direct `npm`; both fallbacks keep
the package arguments fixed and avoid caller-derived command text.

The verifier distinguishes four states:

| Process result | Verification state |
|---|---|
| Spawn error | Fail before status or JSON handling |
| `status: null` | Fail as an indeterminate process result |
| Non-zero status | Fail with npm stderr or the bounded fallback message |
| Zero status and valid one-item JSON report | Continue package-content verification |

At C2 acceptance, workflow
[33175315187](https://github.com/sntllgnc/CINT/actions/runs/33175315187)
proved this contract across all nine Linux, macOS, and Windows lanes on Node.js
22, 24, and 26. Both stable aggregate checks passed at candidate head
`97dac5e80609ba6522f15bb5ecc0a4c0aa5ef022`.

After PR #2 entered `main` through merge commit
`993ba4ce852eb43a36b2fe4395cdfed33756a7de`, workflow
[33179382085](https://github.com/sntllgnc/CINT/actions/runs/33179382085)
re-executed the same nine lanes and both aggregate checks at the exact merge
commit. Every check passed. This establishes source and package-verification
portability at main integration; it does not publish the package or authorize a
deployment.
