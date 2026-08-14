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
| Rules | 108 cards, 3–8 offline seats (default four), classic actions, wild colors, UNO penalty |
| AI | `garfield1993-ai-simple`, `garfield1993-ai-hard`, plus two `uno-2026` profiles |
| UI | Chinese-first main menu (Start game/Settings/About), settings drawer, responsive React table, SVG cards, a 3.8-second deal sequence with starting-player callout, translucent hoverable tabletop direction arrows, draw/play/shuffle motion, settlement result layer, discard history, English toggle |
| Offline setup | One human plus AI seats; each AI pause is 1–30 seconds, default three |
| Multiplayer | Rust room service + WebSocket snapshots: create/join/leave, AI takeover on explicit leave or disconnect, host start, AI seats, four-character waiting-room codes, separate human turn deadlines, three-minute all-disconnected grace, token-based resume, and authoritative next-seat markers |
| Network diagnostics | A quiet corner export control records local WebSocket/REST timings, reconnects, browser network capabilities, and visible edge headers; room codes, tokens, cards, and request bodies are removed before export |
| Deployment | `vercel.json` is present; live deployment must be verified separately |

## Start locally

```bash
npm install
npm run dev
```

Open `http://localhost:1411`. For a production-shaped local run:

```bash
npm run build
npm run preview
```

To force a fresh Rust artifact instead of using the committed browser artifact:

```bash
UNO_REBUILD_WASM=1 npm run build
```

The first screen is a focused main menu with Start game, Settings, and About.
Chinese is the default UI language; use the `EN` control to switch the menu,
settings drawer, and table HUD to English. Open Settings to choose 3–8 players
(four is the default), select an AI profile, and tune each AI seat's pause
independently. Click the discard pile during a match to inspect played cards in
chronological order.
Online now has a Rust room/WebSocket slice. A started-game leave or WebSocket
disconnect converts that seat to AI while preserving the player token; reconnecting
with the same token restores human control. A live WebSocket removes the started
room TTL. If every socket disconnects, the room receives a three-minute grace
window. Expired human turns choose a legal move or draw, and the server sends a
heartbeat so dead sockets are eventually detected. A browser refresh opens an
unfinished-game prompt backed by local storage; Reconnect keeps the token, while
Cancel and forget deletes it. Finished games clear the resume record and obsolete
sockets are closed after the final snapshot. The Rust service is still an
in-memory demo and must be deployed behind TLS with `VITE_ONLINE_API_URL` before
public play.
The online lobby opens in Join mode by default and only asks for a nickname and
four-character room code. Switching to Create mode reveals the host-only seat,
AI-count, and human-turn deadline controls; the create form never asks for a
room code because the server generates it.
The quiet `⌁` control in the lobby and table downloads
`uno-2026-network-*.json` on demand. The log stays local until the player
chooses the download; it is not uploaded automatically. It is intended for
WebSocket upgrade/fallback, reconnect backoff, message counts/sizes, handshake
latency, browser connection capabilities, and navigation timing—not as a game
replay. See the [network diagnostics guide](NETWORK_DIAGNOSTICS.md).
The main menu also keeps a small `alohayo.me` link for the project home without
adding another prominent navigation surface.
When a table opens, all card assets are already loaded and a 3.8-second dealing
sequence lets players read their hand before input is enabled. The first seat is
then called out above the felt. A completed table keeps a result layer visible,
identifying the winner and whether the local player won or lost; the play
direction is drawn as translucent connected arrows around the felt and brightens
on hover instead of occupying the center HUD.

## Documentation map

- [Architecture](ARCHITECTURE.md) — boundaries and ownership.
- [Rules and state](RULES_AND_STATE.md) — deck, legal moves, effects, snapshots.
- [AI profiles](AI_PROFILES.md) — compatibility names and strategy differences.
- [WASM/frontend contract](WASM_FRONTEND_CONTRACT.md) — exported methods and JSON.
- [Server protocol](SERVER_PROTOCOL.md) — room routes, tokens, deadlines, and deployment limits.
- [Development](DEVELOPMENT.md) — toolchain, commands, and directory rules.
- [Testing](TESTING.md) — unit, build, and browser evidence.
- [Deployment](DEPLOYMENT.md) — Vercel configuration and honest status reporting.
- [Table UI reference](TABLE_UI_REFERENCE.md) — generated assets, layout decisions, and interactions.
- [Network diagnostics](NETWORK_DIAGNOSTICS.md) — fields, redaction boundary, and export workflow.
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
