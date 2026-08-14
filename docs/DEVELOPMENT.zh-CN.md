# 开发指南

[English](DEVELOPMENT.md) | 中文 · [文档索引](README.zh-CN.md)

## 工具链

- Node 22 或更高（CI 使用 Node 22）；
- 带 `wasm32-unknown-unknown` target 的 Rust stable；
- `wasm-pack` 0.13 或更高；
- 客户端默认使用 pnpm 11，`pnpm-lock.yaml` 是唯一权威的 JavaScript 锁文件。
- `pnpm-workspace.yaml` 仅显式允许 Vite 所需的 `esbuild` 构建脚本；其他依赖安装脚本继续由
  pnpm 的供应链安全策略拦截。

## 常用命令

```bash
corepack enable
pnpm install
pnpm run dev
pnpm run typecheck
pnpm run build
pnpm run test:browser
cargo fmt --all -- --check
cargo test -p uno-core
cargo run -p uno-server
```

临时调用未安装的外部 CLI 时默认使用 `bunx`；没有 Bun 时，在注释中保留等价的 `npx`
命令作为回退。

Vite 开发服务器默认使用 `1411` 端口，这是本项目专用的纪念数字。

## 修改顺序

规则变更先写/更新 Rust 原生测试，再改 `crates/uno-core`，重建 WASM，最后同步
TypeScript 类型和双语文档。UI 变更必须让 Rust 保持游戏事实来源；玩家可见契约变化时
增加或调整 Playwright 断言。

## 生成文件

`target/`、`node_modules/`、`web/dist/`、Playwright 结果和 `.DS_Store` 都是本地产物。
`web/public/wasm/` 不同：release WASM 有意保留，让干净的 Vercel 构建不依赖本地缓存。
Rust 改动后必须重新生成它。
