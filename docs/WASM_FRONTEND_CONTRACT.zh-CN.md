# WASM / 前端契约

[English](WASM_FRONTEND_CONTRACT.md) · [架构说明](ARCHITECTURE.zh-CN.md)

## 加载边界

`web/src/wasm.ts` 动态加载 `/wasm/uno_core.js`。该文件由
`wasm-pack build crates/uno-core --target web --out-dir ../../web/public/wasm
--release` 生成。`scripts/build-wasm.mjs` 默认使用已提交产物，设置
`UNO_REBUILD_WASM=1` 才会强制重编译；缺少产物时构建仍会失败。

生成目录是发布产物，不是第二份源码。修改规则时先改 Rust，再重建 WASM，之后运行
TypeScript 和浏览器检查。

## 导出类

```text
new UnoGame(seed: number, profile: string)
static new_with_config(seed: number, profile: string, player_count: number)
snapshot(): string
play_card(card_id: number, chosen_color: string)
draw(): string
call_uno(): string
ai_step(): string
restart(seed: number): string
```

`profile` 支持 `garfield1993-ai-simple`、`garfield1993-ai-hard`、
`uno-2026-ai-easy`、`uno-2026-ai-strategist`。未知档位在 Rust 构造函数中暂时回退到
`garfield1993-ai-simple`。

`new_with_config` 会把 `player_count` 限制在 3–8，并创建一个人类席位与其余 AI 席位。
旧的双参数构造器仍创建四人牌桌，以保持兼容。React 的每席位 AI 停顿不会进入这个 ABI；
它只是围绕 `ai_step` 的 UI 调度设置。

## JSON 形状

正常命令返回 `Snapshot`。被拒绝的命令返回：

```json
{
  "ok": false,
  "error": "card-not-playable",
  "snapshot": { "...": "当前状态" }
}
```

快照包含 `players`、`current_player`、`direction`、`active_color`、`top_card`、按时间顺序排列的
`discard_cards`（从旧到新，包含 `top_card`）、摸牌/弃牌数量、`pending_draw`、`status`、`winner`、
`turn_number`、`message`、`last_action`、`ai_profile`。人类 `players[0].hand` 有牌面；AI 的手牌数组为空，但
`hand_count` 可见。React 的弃牌历史面板直接渲染 `discard_cards`，不会从 CSS 或本地 UI 状态推导历史。

## 错误处理

UI 应展示返回的 `error`，并保留返回的快照；不能通过本地改状态来重试被拒绝的命令。
WASM 加载失败属于启动错误，应显示可重试的“牌桌不可用”状态。

## ABI 变更

修改导出方法或快照字段时：

1. 更新 Rust 原生测试；
2. 重建 `web/public/wasm`；
3. 同步更新 `web/src/types.ts` 和本双语文档；
4. 运行生产构建与 Playwright 烟测；
5. 若未来存在旧快照，增加迁移说明。
