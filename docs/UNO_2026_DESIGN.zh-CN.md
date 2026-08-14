# UNO 2026 设计说明

[English](UNO_2026_DESIGN.md) | 中文

UNO 2026 是一个独立、离线优先的卡牌桌。权威规则和 AI 位于
`crates/uno-core`，同时编译为用于测试的原生 Rust crate 和浏览器使用的
`wasm-bindgen` 模块。React 只负责展示与输入，不直接修改牌、回合或手牌。

第一阶段联机功能保持服务端边界简洁：`server/` 是复用同一 JSON 快照形状的 Rust
内存 REST/轮询权威服务，提供四位房间码、15 分钟等待房间、混合人类/AI 席位、房主
生命周期和按查看者隔离的手牌。可持久身份、重连和持久化存储属于后续明确工作项；
当前版本的联机协议和运行时说明以 `SERVER_PROTOCOL` 为准。

界面从中文优先的主菜单开始，只提供开始游戏、设置和关于；设置抽屉负责离线房间
控制。牌桌使用 felt 桌面、可无损缩放的 SVG 卡牌正反面、对手信息、回合状态、摸牌
堆/弃牌堆、响应式手牌、发牌/摸牌/出牌/洗牌动效，以及按需打开的按时间排序弃牌历史。
项目不复制受保护的 UNO 艺术或品牌。内置档位是
`garfield1993-ai-simple`、`garfield1993-ai-hard`、`uno-2026-ai-easy` 和
`uno-2026-ai-strategist`；前两个保留请求的兼容名称，后两个是新的参考策略。

本地验证门槛为：

```text
cargo fmt --all -- --check
cargo test -p uno-core
pnpm run typecheck
pnpm run build
```
