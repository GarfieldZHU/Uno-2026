# Uno-2026 agent guide

## Mission

Maintain an auditable, offline-first UNO table. Rust is the only authority for
rules, state transitions, AI decisions, and serialized snapshots. React/TypeScript
is a view/controller. The server is a disabled protocol scaffold until multiplayer
semantics are designed and tested.

## Read first

1. `README.md` and one of `docs/README.en.md` / `docs/README.zh-CN.md`.
2. The nearest relevant page under `docs/`.
3. The source module before changing its consumer.

## Boundaries

- `crates/uno-core`: deterministic card/domain logic; no DOM, network, or UI state.
- `web`: React HUD and input; never mutate cards or turns locally.
- `server`: `/health` and disabled room placeholder only.
- `web/public/wasm`: generated release artifact; rebuild after Rust changes.
- `wiki`: reviewed GitHub Wiki mirror; update English and Chinese pages together.

## Required workflow

For behavior changes, write a failing native test first, then implement the smallest
Rust change, run the test, rebuild WASM, update the frontend contract, and run the
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
  Chinese pages.
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
