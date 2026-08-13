# 路线图

[English](ROADMAP.md) · [原版仓库](ORIGINAL_REPOSITORY.zh-CN.md)

## 当前

- 保持离线 WASM 牌桌稳定；
- 使用 Rust 房间服务提供创建、加入、退出和房主开始流程；
- 增加规则和浏览器回归覆盖；
- 真实验证 Vercel 部署后再公开 URL。

## 下一步

- 有 checkout 后审计历史 C++ 仓库；
- 把规则变体显式化，不继续硬编码在 `GameState`；
- 增加确定性 replay/export 方便提交 bug；
- 定义原生、WASM、服务端共享的版本化命令/快照 schema。

## 更后面

- 增加持久化身份、重连和服务端房间存储；
- 增加观战语义，并补充服务端并发/传输测试；
- 根据并发需求把轮询升级为 WebSocket 或长轮询。
