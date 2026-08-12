# UNO 2026 design

UNO 2026 is a standalone, offline-first card table. The authoritative rules and AI live in `crates/uno-core`, which is compiled both as a native Rust crate for tests and as a `wasm-bindgen` module for the browser. React owns presentation and input only; it never mutates a card, turn, or hand directly.

The first release keeps multiplayer behind a deliberate boundary. `server/` is a small Rust health/protocol scaffold so a future room service can reuse the same JSON snapshot shape, while the public UI labels the network mode as unavailable. This avoids shipping a misleading online mode before transport, identity, and reconnect semantics exist.

The table uses CSS-rendered original card art: color-coded cards, action glyphs, a felt table, opponent chips, turn state, draw/discard piles, and a responsive hand. It does not copy protected UNO artwork or branding. The shipped profiles are `garfield1993-ai-simple`, `garfield1993-ai-hard`, `uno-2026-ai-easy`, and `uno-2026-ai-strategist`. The first two preserve the requested compatibility names; the latter two are the new reference strategies.

The local verification gate is:

```text
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
```
