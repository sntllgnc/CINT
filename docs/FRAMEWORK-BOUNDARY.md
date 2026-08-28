# CINT framework boundary

## Trusted runtime

CINT R1 is a Node.js control plane with strict TypeScript source and emitted
JavaScript runtime. Its trusted paths are authority evaluation, receipt
authentication and one-shot consumption, revalidation, execution gating,
outcome verification, rollback, evidence, and sealing.

Three.js is absent and irrelevant to these paths. The official
[Three.js fundamentals](https://threejs.org/manual/en/fundamentals.html)
describe a browser/WebGL 3D rendering surface; it supplies no CINT authority,
integrity, validation, or execution primitive.

## Excluded frameworks and targets

R1 contains no Three.js, React, React Three Fiber, Next.js, Vite, webpack,
Electron, Tauri, Rust, WASM, `wasm-bindgen`, `napi-rs`, Neon, web server,
browser bundle, canvas, WebGL scene, UI shell, or visualization code.

A future visualization surface, if separately authorized, must remain outside
authority, receipt, execution, revalidation, and seal paths. It may consume
sanitized terminal evidence; it may not become a control or trust boundary.

An isolated Rust trusted core is deferred to a later decision and must be
justified by a bounded security or correctness requirement. R1 neither begins
nor implies a Rust rewrite.

The C2 package-launch correction is process portability inside the existing
Node.js verification plane. It introduces no framework, UI, browser, Rust,
WASM, or deployment surface and changes no CINT runtime-authority path.

## Language boundary is not framework drift

The R1 control plane integrated into `main` contains 29 TypeScript and zero
JavaScript source files under `src/cint/**`. GitHub's repository-wide language
bar still includes maintained JavaScript in Adapter 01, compatibility modules,
build and verification scripts, legacy tests, and fixtures. That JavaScript is
an explicit ownership boundary, not a hidden framework or an incomplete CINT
core migration.

CINT does not suppress that source with a Linguist override. Migrating the
adapter or tooling would be a separate compatibility project with its own
behavioral proof; it is not required to establish the R1 runtime boundary.
The complete inventory is in
[`LANGUAGE-BOUNDARY.md`](LANGUAGE-BOUNDARY.md).

## Non-claims

The integrated R1 source state does not establish an R1 package release,
production readiness, machine-wide enforcement, hostile-adapter sandboxing,
web-product status, deployment authority, or external-service activation.
