# 架构

```text
React / TypeScript HUD
        ↓ JSON 命令和快照
wasm-bindgen UnoGame
        ↓
Rust uno-core：cards → state → 效果 → AI

server/：未来传输边界，当前关闭
```

Rust 持有事实来源。`SettingsDrawer` 选择离线席位和展示停顿，`CardArt` 渲染卡牌，`DiscardHistory` 渲染快照中的有序
`discard_cards`。浏览器发送命令，但不实现合法出牌或罚牌，因此原生测试与 WASM 使用同一领域实现。详见
[`docs/ARCHITECTURE.zh-CN.md`](../docs/ARCHITECTURE.zh-CN.md)。
