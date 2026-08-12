# UNO 2026 — 中文项目说明

[English](README.en.md) · [根 README](../README.md)

## 项目目的

UNO 2026 是一个确定性的、离线优先的 UNO 牌桌。Rust 负责牌、回合、罚牌、
快照和 AI；React/TypeScript 只负责牌桌和 HUD 的展示以及发送用户操作；浏览器
通过 WebAssembly 使用同一份 Rust 规则，而不是再维护一份 JavaScript 规则。

项目刻意保持可审计。它不声称已经复刻历史 C++ 项目的每个行为细节；原版链接、
来源边界和待核对内容统一记录在[原版仓库与纪念说明](ORIGINAL_REPOSITORY.zh-CN.md)。

## 当前能力

| 领域 | 当前状态 |
| --- | --- |
| 离线游戏 | 浏览器中通过 Rust/WASM 可玩 |
| 规则 | 108 张牌、离线 3–8 个席位（默认四人）、经典功能牌、变色、UNO 罚牌 |
| AI | `garfield1993-ai-simple`、`garfield1993-ai-hard`，以及两个 `uno-2026` 版本 |
| UI | 中文默认的开局设置页、响应式 React HUD、手牌轨道、摸牌/弃牌堆、变色选择器，支持英文切换 |
| 离线设置 | 一名人类加 AI 席位；每个 AI 停顿 1–30 秒，默认三秒 |
| 联机 | 只有骨架；UI 保持锁定，房间接口返回 503 |
| 部署 | 已提供 `vercel.json`；线上部署必须单独验证 |

## 本地启动

```bash
npm install
npm run dev
```

打开 `http://localhost:1411`。如需模拟生产构建：

```bash
npm run build
npm run preview
```

如需强制重新编译 Rust/WASM，而不是使用已提交的浏览器产物：

```bash
UNO_REBUILD_WASM=1 npm run build
```

首次打开会进入中文离线设置页：可选择 3–8 名玩家（默认四人）、AI 档位，并为每个 AI
席位单独调整停顿。顶栏的 `EN` 按钮可以将设置页和牌桌 HUD 切换为英文；联机仍是有意锁定的未来模式；未来房间可以包含多名人类玩家以及
任意数量的 AI，但本版本不宣称联机可用。

## 文档导航

- [架构](ARCHITECTURE.zh-CN.md) —— 模块边界与所有权。
- [规则与状态](RULES_AND_STATE.zh-CN.md) —— 牌堆、合法出牌、效果和快照。
- [AI 档位](AI_PROFILES.zh-CN.md) —— 兼容名称与策略差异。
- [WASM/前端契约](WASM_FRONTEND_CONTRACT.zh-CN.md) —— 导出方法与 JSON。
- [服务端协议](SERVER_PROTOCOL.zh-CN.md) —— 明确关闭的联机边界。
- [开发指南](DEVELOPMENT.zh-CN.md) —— 工具链、命令和目录规则。
- [测试指南](TESTING.zh-CN.md) —— 单元、构建和浏览器证据。
- [部署指南](DEPLOYMENT.zh-CN.md) —— Vercel 配置与诚实的状态说明。
- [原版仓库](ORIGINAL_REPOSITORY.zh-CN.md) —— 来源、链接和纪念意义。
- [路线图](ROADMAP.zh-CN.md) —— 下一步安全增量。
- [贡献指南](CONTRIBUTING.zh-CN.md) —— 修改边界和检查清单。

## 给 Agent 的入口

先阅读仓库根目录的 [`AGENTS.md`](../AGENTS.md)。其中规定了事实来源、验证命令、
生成产物规则、双语文档要求，以及没有线上证据时不能做出的断言。

## 验证命令

```bash
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
npm run test:browser
```

前两个命令验证规则域；后三个命令验证 TypeScript 边界、生产包以及玩家真正看到的
离线启动流程。
