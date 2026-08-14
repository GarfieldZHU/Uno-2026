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
| UI | 中文默认主菜单（开始游戏/设置/关于）、设置抽屉、响应式 React 牌桌、SVG 卡牌、3.8 秒发牌与起始玩家提示、桌面半透明可悬停方向箭头、摸牌/出牌/洗牌动画、结算结果层、弃牌历史和英文切换 |
| 离线设置 | 一名人类加 AI 席位；每个 AI 停顿 1–30 秒，默认三秒 |
| 联机 | Rust 房间服务 + WebSocket 快照：创建/加入/退出、开局离席 AI 接管、房主开始、AI 席位、四位 15 分钟房间码、人类倒计时、重连和权威下家标识 |
| 网络诊断 | 联机界面角落提供低调的日志导出按钮；本地收集 WebSocket/REST 时序、重连、延迟、浏览器网络能力和可见的边缘响应头，导出前自动移除房间码、token、牌面和请求内容 |
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

首次打开会进入中文主菜单。点击“设置”打开抽屉，可选择 3–8 名玩家（默认四人）、AI 档位，并为每个 AI
席位单独调整停顿；点击“开始游戏”直接进入低干扰牌桌。点击弃牌堆可以查看按时间排序的已打出牌。菜单、设置抽屉和牌桌都能切换为英文；联机入口现在可以创建或加入房间，Rust 服务会按玩家 token 隔离手牌并通过 WebSocket 广播，开局后有人离席会由 AI 接管原席位，人类超时会自动合法出牌或摸牌，连接断开会有界重连，无法升级时才有限降级到 REST；服务重启会关闭内存房间，公开使用前需要 TLS 和 `VITE_ONLINE_API_URL`。
联机弹窗默认进入“加入房间”，只显示昵称和四位房间码；切换到“创建房间”后才显示房主专用的总席位、AI 数量和人类回合倒计时设置。创建房间由服务端生成房间码，因此创建界面不会要求填写房间码。
联机大厅和牌桌右下角的 `⌁` 按钮可以一键下载 `uno-2026-network-*.json`。日志只保存在浏览器并由玩家主动下载，不会自动上传；内容用于分析 WebSocket 升级、REST 降级、重连退避、消息大小/次数、握手延迟、页面网络能力和导航时序。请把导出的 JSON 作为附件交给维护者，不要把它当作牌局回放。
主菜单底部保留一个低调的 `alohayo.me` 项目主页链接，不增加醒目的导航区域。
进入牌桌时会先确认资源全部加载，再用约 3.8 秒的发牌动画让玩家看清手牌；动画结束后会在牌桌上方提示从哪位玩家开始，并启用操作。牌局结束后会保留结算层，明确显示获胜者以及当前玩家胜负；出牌方向改为沿牌桌连接玩家位置的半透明箭头，悬停时才增强高亮，不再占用中央 HUD。

## 文档导航

- [架构](ARCHITECTURE.zh-CN.md) —— 模块边界与所有权。
- [规则与状态](RULES_AND_STATE.zh-CN.md) —— 牌堆、合法出牌、效果和快照。
- [AI 档位](AI_PROFILES.zh-CN.md) —— 兼容名称与策略差异。
- [WASM/前端契约](WASM_FRONTEND_CONTRACT.zh-CN.md) —— 导出方法与 JSON。
- [服务端协议](SERVER_PROTOCOL.zh-CN.md) —— 房间路由、token、倒计时和部署边界。
- [开发指南](DEVELOPMENT.zh-CN.md) —— 工具链、命令和目录规则。
- [测试指南](TESTING.zh-CN.md) —— 单元、构建和浏览器证据。
- [部署指南](DEPLOYMENT.zh-CN.md) —— Vercel 配置与诚实的状态说明。
- [牌桌视觉参考](TABLE_UI_REFERENCE.zh-CN.md) —— 生成资源、布局决策和交互。
- [网络诊断](NETWORK_DIAGNOSTICS.zh-CN.md) —— 日志字段、脱敏边界和导出流程。
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
