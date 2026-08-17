# Architecture

English | [中文](Architecture.zh-CN.md)

```text
React / TypeScript HUD
        ↓ JSON commands and snapshots
wasm-bindgen UnoGame
        ↓
Rust uno-core: cards → state → effects → AI

server/: Rust authoritative in-memory room transport, REST + WebSocket
```

Rust owns truth. `SettingsDrawer` selects the offline seat count and presentation
pauses; `CardArt` renders cards and `DiscardHistory` renders the ordered
`discard_cards` snapshot field. The browser sends commands but does not implement
legal moves or penalties. `uno_pending_player` opens a short server-owned UNO
challenge phase before the next turn clock starts. Native tests and WASM therefore
exercise the same domain. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
