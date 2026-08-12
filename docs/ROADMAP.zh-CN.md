# 路线图

[English](ROADMAP.md) · [原版仓库](ORIGINAL_REPOSITORY.zh-CN.md)

## 当前

- 保持离线 WASM 牌桌稳定；
- 增加规则和浏览器回归覆盖；
- 增加原生/WASM 快照 parity fixture；
- 真实验证 Vercel 部署后再公开 URL。

## 下一步

- 有 checkout 后审计历史 C++ 仓库；
- 把规则变体显式化，不继续硬编码在 `GameState`；
- 增加确定性 replay/export 方便提交 bug；
- 定义原生、WASM、服务端共享的版本化命令/快照 schema。

## 更后面

- 实现认证房间和服务端权威隐藏手牌；
- 增加重连和观战语义；
- 端到端传输测试通过后才打开联机开关。
