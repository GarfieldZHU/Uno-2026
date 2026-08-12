# UNO 2026

**Rust + WebAssembly rules. React + TypeScript table. Offline first.**

Choose a language:

- [简体中文 / 中文项目说明](docs/README.zh-CN.md)
- [English / English project guide](docs/README.en.md)

## What this is

UNO 2026 is a modern, offline-first UNO table built around a deterministic Rust
core and a responsive React HUD. The browser loads the same rules engine as the
native Rust tests through WebAssembly; the UI owns presentation and input, not
game truth.

The current vertical slice includes:

- a standard 108-card deck, four players, draw/discard recycling, action cards,
  wild-color selection, UNO calls, penalties, and winner detection;
- four deterministic AI profiles, including the compatibility names
  `garfield1993-ai-simple` and `garfield1993-ai-hard`;
- a CSS-rendered card table with responsive HUD and original, non-franchise card
  artwork;
- a Rust server scaffold with `/health` and an explicitly disabled room endpoint;
- Vercel configuration for the static Vite client.

Online rooms are intentionally not exposed yet. A protocol boundary exists in
`server/`, but identity, reconnect, room authority, and transport semantics still
need to be designed and tested before enabling it.

## Run it locally

Requirements: Node 22+, Rust stable with `wasm32-unknown-unknown`, and
`wasm-pack` 0.13+.

```bash
npm install
npm run dev
```

Then open `http://localhost:4173`.

The verification gate is:

```bash
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
npm run test:browser
```

## Source map

```text
crates/uno-core/    deterministic rules, snapshots, AI, wasm-bindgen export
web/                React + TypeScript table and HUD
server/             deliberately disabled multiplayer protocol scaffold
docs/               bilingual project documentation
wiki/               bilingual GitHub Wiki mirror
scripts/            reproducible WASM artifact build helper
tests/              Playwright offline smoke tests
```

Read the [documentation index](docs/README.en.md) or [中文文档索引](docs/README.zh-CN.md)
for architecture, rules, AI, WASM, testing, deployment, and contribution guides.

## A link back to the old game

This project keeps a visible link to the original C++ implementation:

- [1411-duliu/Uno](https://github.com/1411-duliu/Uno)
- [the original `ai_hard` branch](https://github.com/1411-duliu/Uno/tree/ai_hard/Uno)

That repository is the historical reference and the reason this project exists:
UNO 2026 is a software-archaeology exercise as much as a rewrite. It carries the
old project's memory into a browser, keeps the requested AI profile names, and
separates rules from rendering so the game can keep evolving. The initial build
environment could not fetch the old repository because GitHub DNS was unavailable;
therefore this codebase does **not** claim line-by-line parity with source that was
not inspected. See [the provenance note](docs/ORIGINAL_REPOSITORY.md).

## Project status

The offline table is implemented and covered by Rust, TypeScript, production-build,
and Playwright smoke checks in the local checkout. A live Vercel URL and a public
`GarfieldZHU/Uno-2026` remote are not asserted by this repository until they are
verified from an account with access.

## License and attribution

The new source is released under the MIT License. The old repository remains its
authors' work; this project links to it for provenance and remembrance and does not
copy its source or assets into this tree.
