# Architecture

```text
React / TypeScript HUD
        ↓ JSON commands and snapshots
wasm-bindgen UnoGame
        ↓
Rust uno-core: cards → state → effects → AI

server/: future transport boundary, disabled today
```

Rust owns truth. `SettingsDrawer` selects the offline seat count and presentation
pauses; `CardArt` renders cards and `DiscardHistory` renders the ordered
`discard_cards` snapshot field. The browser sends commands but does not implement
legal moves or penalties. Native tests and WASM therefore exercise the same
domain. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
