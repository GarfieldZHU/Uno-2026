# Uno-2026 agent guide

## Mission

Maintain an auditable, offline-first UNO table. Rust is the only authority for
rules, state transitions, AI decisions, and serialized snapshots. React/TypeScript
is a view/controller. The server owns the first in-memory online room slice;
durable identity and persistence remain future work.

## Read first

1. `README.md` and one of `docs/README.en.md` / `docs/README.zh-CN.md`.
2. The nearest relevant page under `docs/`.
3. The source module before changing its consumer.

## Boundaries

- `crates/uno-core`: deterministic card/domain logic; no DOM, network, or UI state.
- `web`: React HUD and input; never mutate cards or turns locally.
- `web/src/MainMenuScreen.tsx`, `SettingsDrawer.tsx`, and `AboutPanel.tsx`: low-chrome
  menu surfaces; keep room configuration behind Settings and keep About off the table.
- `web/src/CardArt.tsx` and `web/public/assets/cards/`: resolution-independent SVG
  card art; use generated raster art only for atmosphere, never as the rules source.
- `web/src/DiscardHistory.tsx`: renders Rust's ordered `discard_cards` snapshot field;
  never reconstruct played-card history from DOM or CSS.
- `server`: Rust room authority, REST/polling routes, token-scoped snapshots, and TTL cleanup.
- `web/public/wasm`: generated release artifact; rebuild after Rust changes.
- `wiki`: reviewed GitHub Wiki mirror; update English and Chinese pages together.

## Required workflow

For behavior changes, write a failing native test first, then implement the smallest
Rust change, run the test, rebuild WASM when the domain schema changes, update the frontend contract, and run the
browser smoke test. For docs-only changes, still run `git diff --check` (or the
equivalent whitespace check available in the environment).

```bash
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
npm run test:browser
```

## Documentation rules

- Every player-visible or public-contract change updates English and Simplified
  Chinese pages and adds/adjusts a Playwright assertion when the flow changes.
- Link the historical repositories; do not claim their internals were inspected
  unless a checkout or archive is actually available.
- Separate local build evidence, browser evidence, and live deployment evidence.
- Never put tokens, passwords, private keys, or credential-bearing environment
  values in source, docs, logs, issues, or commits.

## Git and generated files

Preserve unrelated user changes. Do not use destructive reset/checkout commands.
Keep `node_modules/`, `target/`, `web/dist/`, Playwright output, and `.DS_Store`
out of commits. Commit `web/public/wasm/` because the static production build
needs a reproducible browser artifact.

## Repository identity

This checkout belongs to the `GarfieldZHU` GitHub account. Its local Git identity
must remain `GarfieldZHU <garfield.bupt@gmail.com>` with `user.useConfigOnly=true`,
so commits cannot silently inherit the `jiazhu_mstr` identity used by unrelated
repositories under `~/Dev`.
