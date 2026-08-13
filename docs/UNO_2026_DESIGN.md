# UNO 2026 design

UNO 2026 is a standalone, offline-first card table. The authoritative rules and AI live in `crates/uno-core`, which is compiled both as a native Rust crate for tests and as a `wasm-bindgen` module for the browser. React owns presentation and input only; it never mutates a card, turn, or hand directly.

The first online slice keeps the room service deliberately small: `server/` is a
Rust in-memory REST/polling authority that reuses the same JSON snapshot shape,
with four-character/15-minute rooms, mixed human/AI seats, host lifecycle, and
viewer-scoped hands. Durable identity, reconnect, and persistent storage remain
explicit follow-up work.

The UI opens on a Chinese-first main menu with Start game, Settings, and About;
the settings drawer owns the offline room controls. The table uses a felt surface,
resolution-independent SVG card fronts/backs, opponent chips, turn state,
draw/discard piles, a responsive hand, deliberate deal/draw/play/shuffle motion,
and an on-demand chronological discard-history dialog. It does not copy protected
UNO artwork or branding. The shipped profiles are `garfield1993-ai-simple`,
`garfield1993-ai-hard`, `uno-2026-ai-easy`, and `uno-2026-ai-strategist`. The
first two preserve the requested compatibility names; the latter two are the new
reference strategies.

The local verification gate is:

```text
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
```
