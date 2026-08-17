# WASM contract

English | [中文](WASM-Contract.zh-CN.md)

The browser creates `UnoGame(seed, profile)` for compatibility or
`UnoGame.new_with_config(seed, profile, player_count)` for a 3–10 seat table, and calls `snapshot`, `play_card`,
`draw`, `call_uno`, `challenge_uno`, `ai_step`, and `restart`. Normal results are snapshots;
rejected commands return an error plus the current snapshot. Snapshots include
ordered `discard_cards` and `uno_pending_player` for the table history and UNO
challenge phase. Generated bindings live
under `web/public/wasm/`. See [`docs/WASM_FRONTEND_CONTRACT.md`](../docs/WASM_FRONTEND_CONTRACT.md).
