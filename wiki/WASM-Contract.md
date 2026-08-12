# WASM contract

The browser creates `UnoGame(seed, profile)` and calls `snapshot`, `play_card`,
`draw`, `call_uno`, `ai_step`, and `restart`. Normal results are snapshots;
rejected commands return an error plus the current snapshot. Generated bindings
live under `web/public/wasm/`. See [`docs/WASM_FRONTEND_CONTRACT.md`](../docs/WASM_FRONTEND_CONTRACT.md).
