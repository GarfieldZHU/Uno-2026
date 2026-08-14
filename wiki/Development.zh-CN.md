# 开发

[English](Development.md) | 中文

运行 `cargo test --workspace`、`pnpm run typecheck`、`pnpm run build` 和
`pnpm run test:browser`；安装依赖前执行 `corepack enable && pnpm install`。规则写在 Rust，
UI 写在 React/CSS，公共契约变化同步两种语言。
使用 Agent 前先读 `AGENTS.md`。详见 [`docs/DEVELOPMENT.zh-CN.md`](../docs/DEVELOPMENT.zh-CN.md)。
