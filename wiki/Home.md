# UNO 2026

English | [中文](Home.zh-CN.md)

Rust rules. WebAssembly offline runtime. React table.

UNO 2026 is a deterministic browser UNO game with a native-testable Rust core and
a responsive TypeScript HUD. It supports the offline table plus a first Rust
REST + WebSocket room slice: four-character codes, 15-minute expiry, mixed
human/AI seats, host start/close, viewer-safe hands, reconnecting clients, and
AI takeover when a started-game player leaves, including host-role transfer. The
room service is in-memory.

The main menu keeps only Start game, Settings, and About. Settings supports 3–8
offline seats (four by default), one human plus AI seats, and an independent
1–30 second pause for every AI seat (three by default). The felt table uses SVG
card art, a 3.8-second initial deal with a starting-player callout, connected
translucent direction arrows that brighten on hover, short draw/play/shuffle
motion, a winner/loser settlement layer, and an on-demand chronological discard
history. Online rooms can mix multiple humans with AI seats and expose a
5–30 second human turn deadline; an expired human turn chooses a legal move or
draws deterministically. Configure the Rust origin before public use.

The lobby defaults to Join room and only shows nickname plus room code. Create
room is a separate host mode; it reveals seat, AI, and deadline settings, while
the server generates the code.
The main menu keeps a small `alohayo.me` project-home link as well.

The lobby and table also expose a quiet `⌁` control for a local network
diagnostics JSON. It records WebSocket/REST timings, reconnects, latency,
browser connection capabilities, and visible edge markers while removing room
codes, tokens, card data, and request bodies before export; nothing is uploaded
automatically.

Chinese is the default interface language. The `EN` control switches the menu,
settings drawer, and in-game HUD to English without restarting the table.

## Start

```bash
corepack enable
pnpm install
pnpm run dev
```

The repository uses pnpm 11 and the checked-in `pnpm-lock.yaml` as its JavaScript
dependency lockfile. For a temporary external CLI, prefer `bunx`; keep an `npx`
fallback as a comment.

## Navigate

- [Architecture](Architecture.md)
- [Rules](Rules.md)
- [AI Profiles](AI-Profiles.md)
- [WASM Contract](WASM-Contract.md)
- [Development](Development.md)
- [Deployment](Deployment.md)
- [History](History.md)

See the [English project guide](../docs/README.en.md) and [中文项目说明](../docs/README.zh-CN.md)
for the complete repository documentation.
