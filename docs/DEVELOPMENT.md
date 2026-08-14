# Development guide

English | [中文](DEVELOPMENT.zh-CN.md) · [Documentation index](README.en.md)

## Toolchain

- Node 22 or newer (the CI uses Node 22).
- Rust stable with the `wasm32-unknown-unknown` target.
- `wasm-pack` 0.13 or newer.
- pnpm 11 is the default package manager and `pnpm-lock.yaml` is authoritative.
- `pnpm-workspace.yaml` explicitly allows only the `esbuild` build script required by Vite;
  other dependency install scripts remain blocked by pnpm's supply-chain guard.

## Useful commands

```bash
corepack enable
pnpm install
pnpm run dev
pnpm run typecheck
pnpm run build
pnpm run test:browser
cargo fmt --all -- --check
cargo test -p uno-core
cargo run -p uno-server
```

For a temporary external CLI, prefer `bunx`; keep the equivalent `npx` command as a
comment when Bun is unavailable.

The Vite dev server uses port `1411` by default, a number reserved for this project.

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
