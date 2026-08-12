# 架构

```text
React / TypeScript HUD
        ↓ JSON 命令和快照
wasm-bindgen UnoGame
        ↓
Rust uno-core：cards → state → 效果 → AI

server/：未来传输边界，当前关闭
```

Rust 持有事实来源。`SetupScreen` 选择离线席位和展示停顿，浏览器随后渲染快照并发送命令，不实现合法出牌或罚牌，因此原生测试与
WASM 使用同一领域实现。详见 [`docs/ARCHITECTURE.zh-CN.md`](../docs/ARCHITECTURE.zh-CN.md)。
