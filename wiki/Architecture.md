# Architecture

```text
React / TypeScript HUD
        ↓ JSON commands and snapshots
wasm-bindgen UnoGame
        ↓
Rust uno-core: cards → state → effects → AI

server/: future transport boundary, disabled today
```

Rust owns truth. `SetupScreen` selects the offline seat count and presentation
pauses; the browser then renders snapshots and sends commands. It does not
implement legal moves or penalties. Native tests and WASM therefore exercise the
same domain. See [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
