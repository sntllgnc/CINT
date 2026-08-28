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

## Non-claims

The R1 candidate does not establish production readiness, machine-wide
enforcement, hostile-adapter sandboxing, web-product status, deployment
authority, or external-service activation.
