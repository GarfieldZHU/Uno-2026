# 服务端协议

[English](SERVER_PROTOCOL.md) | 中文 · [架构说明](ARCHITECTURE.zh-CN.md)

`server/` 现在是模块化的 Rust 权威房间服务：`room.rs` 负责房间/牌局状态和广播，
`http.rs` 负责 REST 路由，`websocket.rs` 负责 RFC 6455 会话。它在内存中保存房间，
复用 `uno-core` 的牌堆、规则和 AI，并把按玩家隔离的快照广播给所有已连接网页。服务
重启会关闭所有活动房间，这是第一版联机切片的明确边界。

## 启动

```bash
UNO_SERVER_ADDR=0.0.0.0:8787 cargo run -p uno-server
curl http://127.0.0.1:8787/health
```

等待中的房间默认有效 15 分钟。牌局开始后不再使用这个房间倒计时：只要至少有一个有效
WebSocket，已开局房间就没有房间过期倒计时。最后一个 WebSocket 断开后，服务保留该房间
3 分钟用于重连。人类回合倒计时是独立概念，限制为 5–30 秒，默认 15 秒。牌的合法性和
效果全部继续由 `crates/uno-core` 负责，handler 不复制规则。

## 路由

| 路由 | 鉴权 | 作用 |
| --- | --- | --- |
| `GET /health` | 无 | 进程健康检查 |
| `POST /api/v1/rooms` | 无 | 创建房间，返回房间码、玩家 token、席位、AI 数量和倒计时 |
| `POST /api/v1/rooms/:code/players` | 无 | 加入等待中的房间，返回玩家 id/token |
| `GET /api/v1/rooms/:code` | 开始后需 `X-Player-Token` | 房间成员、WebSocket 存活/断线保护、回合倒计时和安全快照 |
| `POST /api/v1/rooms/:code/start` | 房主 token | 至少三个总席位时开局，只能开始一次 |
| `POST /api/v1/rooms/:code/actions` | 玩家 token | `play`、`draw`、`call_uno` |
| `DELETE /api/v1/rooms/:code/players/:id` | 对应玩家 token | 退出；等待阶段房主退出关闭房间，开局后席位转 AI |
| `GET /api/v1/rooms/:code/ws?token=...` | query 中玩家 token | WebSocket 快照流 |

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
人类席位。服务只把当前 token 对应玩家的手牌返回给该玩家，其他玩家只返回数量。WebSocket
断开不会删除玩家会话或座位：该座位会标记为 AI 控制，由房间调度器继续出牌；使用同一个
player token 重连后会恢复人类控制和该玩家可见的手牌。显式调用 REST 退出则不再可用该会话，
开局座位转为 AI；如果离席的是房主，房主权限转移给剩余人类玩家。
AI 由房间调度器自动行动；人类倒计时结束时，服务会确定性地随机选择一张合法牌，或摸取
应受的牌数，然后广播新快照。每个快照都包含 `current_player`、`next_player` 和
`direction`，网页端不再自行猜测下家。每个改变状态的 REST 请求都会广播 `room.snapshot`；
AI 和超时变化也会广播。网页端以 WebSocket 为主通道，断线会使用有界退避重连；无法升级时
再降级到有限频率的 REST 刷新。

WebSocket 使用文本 JSON 信封：

```json
{"type":"room.snapshot","room":{"code":"ABCD","status":"playing","snapshot":{}}}
```

网页客户端会明确以 snake_case 发送 `max_players`、`ai_count`、
`countdown_seconds` 和 `ai_profile`。本地 Vite 开发服务器把 `/api` 代理到
`127.0.0.1:8787`；部署后的客户端应把 `VITE_ONLINE_API_URL` 设置为 Rust 房间服务的
HTTPS 地址。

为了支持刷新恢复，浏览器本地只保存版本号、房间码、玩家 id、player token、房主标志和
时间戳，不保存手牌或完整快照。大厅会提供“重新连接”或“取消并清除”；后者会删除 token，
该浏览器之后不能再恢复这次会话。

服务每 15 秒发送协议级 WebSocket 心跳，清除死订阅；牌局结束后短暂保留最终快照，再清理
废止连接。`/health` 会返回 `disconnect_grace_seconds`、`state_retention_seconds` 和
`state_store: "in-memory"`。当前没有磁盘牌局数据库：每日 UTC 维护任务会删除六小时未更新的
记录，等待/断线/结束房间的常规 TTL 则持续执行。服务重启会关闭所有内存房间。

第一版使用小型 HTTP/WebSocket 实现，公开部署前必须放在 TLS 和反向代理后；Vite 开发
代理已启用 `ws: true` 转发 WebSocket。不要把房间 token、部署凭据或服务器密码提交到仓库。
