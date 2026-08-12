# 服务端协议边界

[English](SERVER_PROTOCOL.md) · [架构说明](ARCHITECTURE.zh-CN.md)

`server/` 当前只是一个很小的 Rust TCP/HTTP 骨架，不是可玩的联机服务。它监听
`UNO_SERVER_ADDR`（默认 `127.0.0.1:8787`），目前只有：

| 路由 | 响应 | 含义 |
| --- | --- | --- |
| `GET /health` | `200` JSON | 进程健康和骨架模式 |
| `GET /api/v1/rooms` | `503` JSON | 明确关闭联机 |
| 其他路径 | `404` JSON | 当前没有该路由 |

启用房间前必须定义并测试认证、房间所有权、服务端隐藏手牌、命令顺序、重连、限流和
版本化协议。服务端必须复用 Rust 领域层，不能在 handler 中复制规则。

启动骨架：

```bash
cargo run -p uno-server
curl http://127.0.0.1:8787/health
```

在接口返回经过测试的房间契约、而不是 `multiplayer-disabled` 之前，不要把它宣传成可用
联机功能。
