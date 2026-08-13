# 服务端协议

[English](SERVER_PROTOCOL.md) · [架构说明](ARCHITECTURE.zh-CN.md)

`server/` 现在是一个 Rust 权威房间服务。它在内存中保存房间，复用
`uno-core` 的牌堆、规则和 AI；服务重启会关闭所有活动房间，这是第一版联机切片的
明确边界。

## 启动

```bash
UNO_SERVER_ADDR=0.0.0.0:8787 cargo run -p uno-server
curl http://127.0.0.1:8787/health
```

房间默认有效 15 分钟，房间码是四位大写字符。人类回合倒计时限制为 5–30 秒，默认
15 秒。牌的合法性和效果全部继续由 `crates/uno-core` 负责，handler 不复制规则。

## 路由

| 路由 | 鉴权 | 作用 |
| --- | --- | --- |
| `GET /health` | 无 | 进程健康检查 |
| `POST /api/v1/rooms` | 无 | 创建房间，返回房间码、玩家 token、席位、AI 数量和倒计时 |
| `POST /api/v1/rooms/:code/players` | 无 | 加入等待中的房间，返回玩家 id/token |
| `GET /api/v1/rooms/:code` | 开始后需 `X-Player-Token` | 房间成员、过期时间、倒计时和对当前玩家安全的快照 |
| `POST /api/v1/rooms/:code/start` | 房主 token | 至少三个总席位时开局，只能开始一次 |
| `POST /api/v1/rooms/:code/actions` | 玩家 token | `play`、`draw`、`call_uno` |
| `DELETE /api/v1/rooms/:code/players/:id` | 对应玩家 token | 退出；房主退出会关闭房间 |

创建示例：

```json
{
  "name": "Host",
  "max_players": 4,
  "ai_count": 2,
  "countdown_seconds": 15,
  "ai_profile": "garfield1993-ai-hard"
}
```

`max_players` 限制为 3–8，与离线引擎一致。`ai_count` 可以为 0，但必须保留至少一个
人类席位。服务只把当前 token 对应玩家的手牌返回给该玩家，其他玩家只返回数量。AI 会
在轮询时自动行动，人类倒计时结束会自动摸牌。

第一版使用小型 HTTP 实现，公开部署前必须放在 TLS 和反向代理后。不要把房间 token、部署
凭据或服务器密码提交到仓库。
