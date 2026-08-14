# WASM 契约

[English](WASM-Contract.md) | 中文

浏览器可以创建兼容的 `UnoGame(seed, profile)`，也可以使用
`UnoGame.new_with_config(seed, profile, player_count)` 创建 3–8 人牌桌，再调用 `snapshot`、`play_card`、`draw`、`call_uno`、
`ai_step` 和 `restart`。正常结果是快照；被拒绝的命令返回错误和当前快照。快照包含按时间排序的 `discard_cards`，供牌桌历史面板使用。
生成绑定放在 `web/public/wasm/`。详见 [`docs/WASM_FRONTEND_CONTRACT.zh-CN.md`](../docs/WASM_FRONTEND_CONTRACT.zh-CN.md)。
