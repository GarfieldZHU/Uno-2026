# Development guide

[中文](DEVELOPMENT.zh-CN.md) · [Documentation index](README.en.md)

## Toolchain

- Node 22 or newer (the CI uses Node 22).
- Rust stable with the `wasm32-unknown-unknown` target.
- `wasm-pack` 0.13 or newer.
- npm, not a second package manager, is the checked-in client workflow.

## Useful commands

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run test:browser
cargo fmt --all -- --check
cargo test -p uno-core
cargo run -p uno-server
```

## Change order

For a rules change, write or update a native Rust test first, implement in
`crates/uno-core`, rebuild the WASM artifact, then update TypeScript types and the
two language docs. For a UI change, keep game truth in Rust and add/adjust a
Playwright assertion when the player-visible contract changes.

## Generated files

`target/`, `node_modules/`, `web/dist/`, Playwright results, and `.DS_Store` are local
outputs. `web/public/wasm/` is different: the release WASM artifact is intentionally
kept so a clean Vercel build can load the browser module without relying on a local
cache. Rebuild it whenever Rust changes.
