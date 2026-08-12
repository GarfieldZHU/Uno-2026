# UNO 2026 — English project guide

[简体中文](README.zh-CN.md) · [root README](../README.md)

## Purpose

UNO 2026 is a deterministic, offline-first UNO card table. Rust is the authority
for cards, turns, penalties, snapshots, and AI. React and TypeScript render the
table and send user commands. WebAssembly is the browser boundary, not a second
rules implementation.

The project is intentionally small enough to audit. It is not a claim that every
quirk of the historical C++ project has already been reproduced. The original
source link and the unverified parity boundary are recorded in
[Original repository and memorial](ORIGINAL_REPOSITORY.md).

## Current capabilities

| Area | Current state |
| --- | --- |
| Offline game | Playable in the browser through Rust/WASM |
| Rules | 108 cards, four players, classic actions, wild colors, UNO penalty |
| AI | `garfield1993-ai-simple`, `garfield1993-ai-hard`, plus two `uno-2026` profiles |
| UI | Responsive React HUD, hand rail, draw/discard piles, color chooser |
| Multiplayer | Scaffold only; UI remains locked and room endpoint returns 503 |
| Deployment | `vercel.json` is present; live deployment must be verified separately |

## Start locally

```bash
npm install
npm run dev
```

Open `http://localhost:4173`. For a production-shaped local run:

```bash
npm run build
npm run preview
```

To force a fresh Rust artifact instead of using the committed browser artifact:

```bash
UNO_REBUILD_WASM=1 npm run build
```

## Documentation map

- [Architecture](ARCHITECTURE.md) — boundaries and ownership.
- [Rules and state](RULES_AND_STATE.md) — deck, legal moves, effects, snapshots.
- [AI profiles](AI_PROFILES.md) — compatibility names and strategy differences.
- [WASM/frontend contract](WASM_FRONTEND_CONTRACT.md) — exported methods and JSON.
- [Server protocol](SERVER_PROTOCOL.md) — intentionally disabled multiplayer surface.
- [Development](DEVELOPMENT.md) — toolchain, commands, and directory rules.
- [Testing](TESTING.md) — unit, build, and browser evidence.
- [Deployment](DEPLOYMENT.md) — Vercel configuration and honest status reporting.
- [Original repository](ORIGINAL_REPOSITORY.md) — source link, provenance, and memorial note.
- [Roadmap](ROADMAP.md) — the next safe increments.
- [Contributing](CONTRIBUTING.md) — change boundaries and review checklist.

## For agents

Start with [`AGENTS.md`](../AGENTS.md). It defines source-of-truth boundaries,
commands, generated-artifact rules, documentation language requirements, and the
things an agent must not claim without live evidence.

## Verification

```bash
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
npm run test:browser
```

The first two commands validate the domain directly. The last three validate the
TypeScript boundary, production bundle, and player-visible offline boot.
