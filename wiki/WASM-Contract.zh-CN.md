# WASM 契约

浏览器创建 `UnoGame(seed, profile)`，调用 `snapshot`、`play_card`、`draw`、`call_uno`、
`ai_step` 和 `restart`。正常结果是快照；被拒绝的命令返回错误和当前快照。生成绑定放在
`web/public/wasm/`。详见 [`docs/WASM_FRONTEND_CONTRACT.zh-CN.md`](../docs/WASM_FRONTEND_CONTRACT.zh-CN.md)。
