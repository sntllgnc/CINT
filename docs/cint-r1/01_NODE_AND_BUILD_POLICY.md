# CINT R1 G1 — Node, build, CI, and package policy

Baseline: `acc857b5d6fadd363816ad9dbf2fdc710a35ba15`.

Reviewer B ran read-only in a clean, history-free context with
`gpt-5.6-terra`, medium reasoning, no child agents, and the prescribed bounded
scope. Root independently reproduced the cited files and hashes and adjudicated
the matrix design against the controlling task.

## Runtime policy

The official Node.js release table at admission time reports Node 20 EOL, Node
22 LTS, Node 24 LTS, and Node 26 Current. CINT R1 therefore declares:

| Major | R1 role |
|---|---|
| 20 | historical only; rejected by active engines and absent from active CI |
| 22 | temporary compatibility lane |
| 24 | normative development and operational baseline |
| 26 | forward-compatibility lane; not the normative baseline |

`engines.node` will be exactly `^22.0.0 || ^24.0.0 || ^26.0.0`.
`.nvmrc` and `.node-version` select major 24; `.npmrc` enables
`engine-strict=true`. A supported/tested major is not a frozen patch release:
operators must use the latest security-patched release available within that
major.

Observed active Node 20 declarations are in `package.json:36-38`, the generated
root metadata in `package-lock.json:19-21`, the CI matrix at
`.github/workflows/cint-r0-verification.yml:26-34`, and active root guidance.
Frozen release notes, `docs/archive/**`, evidence, and tagged material retain
their historical Node 20 statements unchanged.

## One complete matrix, two aggregates

The complete R1 matrix remains nine lanes:

```text
ubuntu-24.04  x Node 22, 24, 26
macos-26      x Node 22, 24, 26
windows-2025  x Node 22, 24, 26
```

Every lane installs the lockfile and runs the complete ordered R1 verification.
Both stable aggregate jobs depend on that same matrix:

- `CINT-R0 remote verification`
- `CINT-R1 TypeScript verification`

Each aggregate uses `if: always()` and fails unless the shared matrix result is
`success`. There is no second or reduced matrix.

## Cross-platform build

Shell-specific deletion, copy, and glob behavior are prohibited. Node scripts
will implement:

- `clean`: remove only declared generated roots;
- `build`: compile strict CINT TypeScript and copy only the allowlisted legacy
  JavaScript compatibility surface;
- `test:cint`: compile tests to `.test-dist/` and run them there;
- `pack:verify`: inspect a dry-run tarball manifest and resolve JS plus
  declaration targets.

The baseline already demonstrates a portable `npm.cmd` branch for Windows at
`scripts/verify-cint-schema-package.mjs:40-55`.

Generated and never committed:

```text
dist/
.test-dist/
*.tsbuildinfo
```

## Distribution contract

At G7, CINT exports move from source paths (`package.json:19-24`) to conditional
`types` and `import` targets in `dist/` for:

- `.`;
- `./cli`;
- `./adapters/synthetic-file-patch`;
- `./adapters/codex-delegation`.

The `cint` bin resolves to compiled JavaScript. The `agent-floor` bin and legacy
JavaScript kernel remain preserved. The package remains `private: true`; dry-run
packing proves structure only and grants no publication authority.

Historical AF-G0 evidence scripts retain their existing identity and semantics.
R1 build output is excluded from the immutable historical evidence manifest.

## Source anchors

- `package.json`: `e334fbfc29c3ef28eea299fd597ecc40303d2bb323db9197681b7d1fdc5a367b`
- `package-lock.json`: `6a8a7a9c7deb0972ea3a1b4532f8fd2c195a1fa9a8bf528dd3963e210d68e139`
- workflow: `3f0684fadbff12e7e62327e70e71b201e4c64a91c25a87575b111d57339bad6f`
- package verifier: `d961acb8126edb6219a348520c4541c10a4012a690104d25bc0b4d36ffae5054`
- `bin/cint.js`: `76ba84e79816d5b4af4b20373a03a614d50fa6fb64d6bde8c0d3194998450ba6`
- `bin/agent-floor.js`: `9513e632c1b229d7bd5bb4d69211900cd728494014671c0fd00e11fe89a74394`

G1 verdict: `PASS-CINT-R1-G1-B`.
