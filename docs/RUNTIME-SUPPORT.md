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
