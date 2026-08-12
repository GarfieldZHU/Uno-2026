# 架构说明

[English](ARCHITECTURE.md) · [文档索引](README.zh-CN.md)

## 所有权模型

```text
React + TypeScript UI
        │ 用户命令 / JSON 快照
        ▼
wasm-bindgen 门面（UnoGame）
        │
        ▼
crates/uno-core
  cards → state → 规则/效果 → AI → 快照

server/  未来传输边界（当前不启用）
```

Rust 领域层是唯一事实来源。浏览器中的 `UnoGame` 持有一个 `GameState`；UI 的每个
操作都调用导出方法并接收序列化快照。React 不直接删除牌、不推进回合，也不自己
施加罚牌，因此原生测试和浏览器行为使用同一份实现。

## 目录职责

| 路径 | 负责内容 | 不应负责 |
| --- | --- | --- |
| `crates/uno-core/src/cards.rs` | 颜色、牌型、牌 ID、牌堆词汇 | DOM 或浏览器 API |
| `crates/uno-core/src/state.rs` | 牌堆、手牌、回合、效果、罚牌、快照 | CSS、网络会话 |
| `crates/uno-core/src/ai.rs` | 确定性的出牌选择 | UI 延迟或浏览器随机数 |
| `crates/uno-core/src/lib.rs` | Rust 公共导出和 wasm-bindgen 门面 | 复制规则 |
| `web/src/App.tsx` | 牌桌组合、输入、AI 节奏 | 权威状态修改 |
| `web/src/SetupScreen.tsx` | 离线席位、档位、停顿设置 | 牌和回合规则 |
| `web/src/types.ts` | TypeScript 视图类型和文案 | 规则判断 |
| `web/src/wasm.ts` | 延迟加载浏览器模块 | 备用规则引擎 |
| `web/src/styles.css` | 视觉系统和响应式布局 | 游戏状态 |
| `server/src/main.rs` | 健康检查/协议占位 | 已启用的联机权威 |

## 状态流

1. `SetupScreen` 收集 3–8 个席位（默认四人）、AI 档位和每个 AI 的 1–30 秒展示停顿（默认三秒）。
2. 只有点击离线开始后，`App` 才创建 `UnoGame.new_with_config(seed, profile, player_count)`。
3. Rust 构造确定性的 108 张牌、使用 seed 洗牌、给每个席位发七张牌，并以数字牌作为首张弃牌。
4. 门面返回 JSON `Snapshot`；AI 的具体手牌被隐藏，只公开数量。
5. 人类命令（`play_card`、`draw`、`call_uno`）由 Rust 校验。
6. AI 回合通过 `ai_step` 推进，UI 只添加设置好的展示停顿以便看清动作；选择本身在 Rust 中
   确定性完成。
7. 终局快照以 `status: "Won"` 和 `winner` 标识获胜者。

## 确定性

牌堆使用显式 `u64` seed 和本地 xorshift 风格序列洗牌；AI 不使用浏览器随机数。
在相同 seed、档位和命令序列下，原生 Rust 与 WASM 应产生相同快照。这是项目不变式；
未来修改导出 JSON 前，应增加原生 JSON 与浏览器 JSON 的 parity fixture。

## 为什么不把规则写进 React？

目标是让 Rust 规则同时服务离线 WASM 和未来服务端。若在 UI 再复制一套合法性与
效果逻辑，就会出现两个权威来源，并让联机一致性更难保证。因此 React 只是视图/控制器，
不是模拟器。
