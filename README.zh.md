# UNO 2026

[English](README.md) | 中文

**Rust + WebAssembly 规则核心，React + TypeScript 牌桌，离线优先。**

UNO 2026 是一个现代化的 UNO 牌桌：Rust 负责确定性的牌、回合、罚牌、快照和
AI；React/TypeScript 负责展示与输入；浏览器通过 WebAssembly 使用同一份规则。

## 当前能力

- 标准 108 张牌，离线支持 3–8 个席位，默认四人；支持功能牌、变色、UNO 罚牌、
  摸牌堆回收和胜负结算；
- `garfield1993-ai-simple`、`garfield1993-ai-hard` 以及两个 UNO 2026 AI 档位；
- 中文默认的简洁主菜单，仅提供开始游戏、设置、关于，并可切换英文；
- SVG 卡牌资源、按座位飞行的 3.8 秒发牌动画、出牌/摸牌/洗牌动效、方向箭头、弃牌历史和结算层；
- 局内记录抽屉：记录每个 Rust 快照中的玩家、出牌、当前花色、方向、下家和剩余手牌数，
  支持本地回放与 JSON 导出，方便复盘；
- Rust REST + WebSocket 联机房间：四位房间码、混合人类/AI、房主开始、断线 AI
  接管、同 token 重连、全断线三分钟保护以及人类回合倒计时；
- 联机大厅和牌桌提供低调的网络诊断导出，日志脱敏后只保存到玩家本地，不会自动上传；
- Vercel 静态客户端配置，默认开发端口为纪念数字 `1411`。

## 本地启动

环境要求：Node 22+、Rust stable、`wasm32-unknown-unknown` target、`wasm-pack` 0.13+、
pnpm 11。仓库以 `pnpm-lock.yaml` 为唯一 JavaScript 依赖锁定文件。

```bash
corepack enable
pnpm install
pnpm run dev
```

打开 <http://localhost:1411>。

验证命令：

```bash
cargo fmt --all -- --check
cargo test --workspace
pnpm run typecheck
pnpm run build
pnpm exec playwright install --with-deps chromium
pnpm run test:browser
```

临时调用未安装的外部 CLI 时，默认使用 `bunx`；如果环境没有 Bun，可使用注释中的
`npx` 等价命令。例如：

```bash
bunx playwright test tests/offline.spec.ts
# npx playwright test tests/offline.spec.ts
```

## 文档与 Wiki

- [中文项目说明](docs/README.zh-CN.md) · [English project guide](docs/README.en.md)
- [架构](docs/ARCHITECTURE.zh-CN.md)、[规则与状态](docs/RULES_AND_STATE.zh-CN.md)、
  [服务端协议](docs/SERVER_PROTOCOL.zh-CN.md)、[开发指南](docs/DEVELOPMENT.zh-CN.md)
- [部署指南](docs/DEPLOYMENT.zh-CN.md)、[测试指南](docs/TESTING.zh-CN.md)、
  [网络诊断](docs/NETWORK_DIAGNOSTICS.zh-CN.md)
- [Wiki 镜像](wiki/Home.zh-CN.md)

## 原版仓库与纪念意义

- [1411-duliu/Uno](https://github.com/1411-duliu/Uno)
- [原版 `ai_hard` 分支](https://github.com/1411-duliu/Uno/tree/ai_hard/Uno)

UNO 2026 是对旧 C++ UNO 游戏的延续和纪念：保留历史 AI 名称，把规则从旧桌面环境
带到 Rust、WASM 和 Web，同时明确区分已验证事实与尚未逐行核对的历史行为。详见
[原版仓库与纪念说明](docs/ORIGINAL_REPOSITORY.zh-CN.md)。

## 项目与许可

仓库属于 [GarfieldZHU/Uno-2026](https://github.com/GarfieldZHU/Uno-2026)。新代码
使用 MIT License；原版仓库及其素材仍归原作者所有，本项目仅用于来源链接和历史纪念。
生产部署状态必须以 Vercel READY 部署和实际 Rust 服务健康检查为准。
