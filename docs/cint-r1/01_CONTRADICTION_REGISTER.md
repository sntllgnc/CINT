# CINT R1 G1 — contradiction and risk register

Baseline: `acc857b5d6fadd363816ad9dbf2fdc710a35ba15`.

| ID | Observation | Adjudication |
|---|---|---|
| G1-C01 | Reviewer B recommended separate runtime and package matrices. | Rejected. Both required aggregates must depend on the same complete nine-lane R1 matrix. |
| G1-C02 | The available local baseline runtime is Node 25, which the R1 engine expression intentionally rejects and which upstream marks EOL. | Switch to an installed/current Node 24 patch before adding `engine-strict=true`; all G2+ local gates run on Node 24. |
| G1-C03 | Active R0 text and frozen R0 release notes both mention Node 20. | Update active support claims; preserve `docs/archive/**`, public R0 release notes, frozen evidence, tagged history, and historical changelog facts byte-for-byte. |
| G1-C04 | G3 requires type contracts while the JavaScript runtime remains active. | Compile a type-only R1 layer and negative contracts without redirecting runtime imports or exports until the migration gates. |
| G1-C05 | Strict CINT compilation must consume a retained JavaScript Adapter 01 kernel. | Admit it only through an explicit typed CINT boundary; allow/copy only the enumerated legacy surface with `allowJs: true`, `checkJs: false`. No arbitrary deep legacy imports enter CINT production code. |
| G1-C06 | `npm audit` is network-sensitive, but it is a mandatory verification stage. | Keep it in the exact ordered gate after deterministic tests; report infrastructure failure distinctly and never weaken or omit it. |
| G1-C07 | Dry-run packing can resemble publication work while release authority is absent. | `npm pack --dry-run --json --ignore-scripts` is structure verification only. Package stays private; no registry command is authorized. |
| G1-C08 | TypeScript types are erased and cannot enforce untrusted runtime records. | Preserve all AJV, canonical JSON, digest, HMAC, revalidation, one-shot, trusted-time, outcome, and seal checks as runtime authority. |
| G1-C09 | Three.js is a browser/WebGL 3D library; Rust/WASM/UI are unrelated to this migration. | Keep dependency and source scans that fail if any prohibited framework, Rust, WASM, browser, server, canvas, WebGL, or visualization surface enters CINT. |

No contradiction requires a HOLD at G1. Any later schema-byte, protocol, error,
canonical-byte, receipt-signature, legacy-behavior, or authority-order drift does.

G1 verdict: `PASS-CINT-R1-G1`.
