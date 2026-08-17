# 架构

[English](Architecture.md) | 中文

```text
React / TypeScript HUD
        ↓ JSON 命令和快照
wasm-bindgen UnoGame
        ↓
Rust uno-core：cards → state → 效果 → AI

server/：Rust 权威内存房间传输层，提供 REST + WebSocket
```

Rust 持有事实来源。`SettingsDrawer` 选择离线席位和展示停顿，`CardArt` 渲染卡牌，`DiscardHistory` 渲染快照中的有序
`discard_cards`。浏览器发送命令，但不实现合法出牌或罚牌；`uno_pending_player` 会在下一回合倒计时开始前打开由服务端维护的短暂 UNO 揭发阶段，因此原生测试与 WASM 使用同一领域实现。详见
[`docs/ARCHITECTURE.zh-CN.md`](../docs/ARCHITECTURE.zh-CN.md)。
