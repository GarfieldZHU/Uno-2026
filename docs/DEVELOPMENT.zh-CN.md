# 开发指南

[English](DEVELOPMENT.md) · [文档索引](README.zh-CN.md)

## 工具链

- Node 22 或更高（CI 使用 Node 22）；
- 带 `wasm32-unknown-unknown` target 的 Rust stable；
- `wasm-pack` 0.13 或更高；
- 客户端统一使用 npm，不额外维护第二套包管理流程。

## 常用命令

```bash
npm install
npm run dev
npm run typecheck
npm run build
npm run test:browser
cargo fmt --all -- --check
cargo test -p uno-core
cargo run -p uno-server
```

Vite 开发服务器默认使用 `1411` 端口，这是本项目专用的纪念数字。

## 修改顺序

规则变更先写/更新 Rust 原生测试，再改 `crates/uno-core`，重建 WASM，最后同步
TypeScript 类型和双语文档。UI 变更必须让 Rust 保持游戏事实来源；玩家可见契约变化时
增加或调整 Playwright 断言。

## 生成文件

`target/`、`node_modules/`、`web/dist/`、Playwright 结果和 `.DS_Store` 都是本地产物。
`web/public/wasm/` 不同：release WASM 有意保留，让干净的 Vercel 构建不依赖本地缓存。
Rust 改动后必须重新生成它。
