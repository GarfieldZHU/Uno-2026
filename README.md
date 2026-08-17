# UNO 2026

**Rust + WebAssembly rules. React + TypeScript table. Offline first.**

English | [中文](README.zh.md)

## What this is

UNO 2026 is a modern, offline-first UNO table built around a deterministic Rust
core and a responsive React HUD. The browser loads the same rules engine as the
native Rust tests through WebAssembly; the UI owns presentation and input, not
game truth.

The current vertical slice includes:

- a standard 108-card deck with configurable offline tables for 3–8 seats
  (default four), draw/discard recycling, action cards, wild-color selection,
  UNO calls, penalties, and winner detection;
- one human seat plus AI seats in offline mode, with an independent 1–30 second
  pause per AI seat (default three seconds) so the table can be tuned for a
  readable or rapid rhythm;
- four deterministic AI profiles, including the compatibility names
  `garfield1993-ai-simple` and `garfield1993-ai-hard`;
- a Chinese-first main menu with only Start game, Settings, and About, plus a
  settings drawer for the 3–8 seat and 1–30 second offline controls;
- a top-down oval felt tabletop with generated wood/portrait assets, resolution-independent
  SVG card fronts/backs, perimeter seats, fan-shaped hands, seat-to-seat dealing motion,
  draw/play/shuffle motion, a clickable discard history, and a local match-record drawer
  with replay and JSON export;
- an English toggle available from the menu, settings drawer, and table HUD;
- a Rust room service with four-character waiting-room codes, 15-minute waiting
  expiry, 3–8 seats, configurable AI seats, host-owned start/close semantics,
  viewer-safe hands, and separate 5–30 second human turn deadlines;
- a quiet online-lobby/table network-log export that records redacted WebSocket
  and REST timings, reconnects, browser connection capabilities, and public
  edge clues without uploading automatically;
- an in-table match record that observes every distinct Rust snapshot, including the
  actor, card, active color, direction, next player, hand counts, and penalty state;
  the record can be replayed locally or exported for post-game review;
- Vercel configuration for the static Vite client.

Online rooms now expose a modular REST + WebSocket slice. A started-game leave
or disconnect keeps the seat in the turn ring and hands it to AI; reconnecting
with the same player token restores human control. Live sockets remove the
started-room TTL; when all sockets disappear, the room has a three-minute grace
window. Expired human turns choose a legal move or draw deterministically, and
the service sends heartbeat frames to detect dead connections. Browser refreshes
offer a local resume/forget prompt. The service is still in-memory: restart
closes active rooms, a daily UTC pass removes six-hour-stale records, and public
deployment still needs TLS, rate limiting, and durable identity. See
[`docs/SERVER_PROTOCOL.md`](docs/SERVER_PROTOCOL.md).

## Run it locally

Requirements: Node 22+, Rust stable with `wasm32-unknown-unknown`, `wasm-pack` 0.13+,
and pnpm 11. The checked-in `pnpm-lock.yaml` is the authoritative JavaScript lockfile.

```bash
corepack enable
pnpm install
pnpm run dev
```

Then open `http://localhost:1411`.

The verification gate is:

```bash
cargo fmt --all -- --check
cargo test --workspace
pnpm run typecheck
pnpm run build
pnpm exec playwright install --with-deps chromium
pnpm run test:browser
```

For a temporary external CLI, prefer `bunx`; keep an `npx` fallback as a comment:

```bash
bunx playwright test tests/offline.spec.ts
# npx playwright test tests/offline.spec.ts
```

## Source map

```text
crates/uno-core/    deterministic rules, snapshots, AI, wasm-bindgen export
web/                React + TypeScript table and HUD
server/             Rust room authority and REST/polling protocol
docs/               bilingual project documentation
wiki/               bilingual GitHub Wiki mirror
scripts/            reproducible WASM artifact build helper
tests/              Playwright offline smoke tests
```

Read the [English documentation index](docs/README.en.md) or [中文文档索引](docs/README.zh-CN.md)
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

The local checkout is covered by Rust, TypeScript, production-build, and
Playwright smoke checks. The public repository is
[GarfieldZHU/Uno-2026](https://github.com/GarfieldZHU/Uno-2026). `vercel.json`
contains the Vercel build contract, but a live READY deployment and custom DNS
must be verified in the GarfieldZHU Vercel team before a public URL is claimed.
The separate Rust room origin must be configured with `VITE_ONLINE_API_URL`
before public online rooms can be used.

## License and attribution

The new source is released under the MIT License. The old repository remains its
authors' work; this project links to it for provenance and remembrance and does not
copy its source or assets into this tree.
