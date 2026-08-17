# Server protocol

English | [中文](SERVER_PROTOCOL.zh-CN.md) · [Architecture](ARCHITECTURE.md)

`server/` is now a small modular Rust authoritative room service. `room.rs`
owns room/game state and broadcasts, `http.rs` owns the REST boundary, and
`websocket.rs` owns the RFC 6455 session. It keeps room state in memory,
reuses `uno-core` for deck/rules/AI, and broadcasts viewer-scoped snapshots to
every connected browser. A restart closes all active rooms; durable
matchmaking and authentication are outside this first online slice.

## Run

```bash
UNO_SERVER_ADDR=0.0.0.0:8787 cargo run -p uno-server
curl http://127.0.0.1:8787/health
```

Waiting rooms have a 15-minute TTL. Once a game starts, that waiting-room TTL is
removed: a room with at least one live WebSocket has no room-expiry countdown.
When the last WebSocket disconnects, the service keeps the started room for a
three-minute reconnect grace period. Human turn timeouts are separate, clamped
to 5–30 seconds and defaulting to 15 seconds. Existing UNO rules remain in
`crates/uno-core`; handlers never duplicate card legality or effects.

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | process health |
| `POST /api/v1/rooms` | none | create a room; returns code, player token, seats, AI count, timeout |
| `POST /api/v1/rooms/:code/players` | none | join a waiting room; returns player id/token |
| `GET /api/v1/rooms/:code` | `X-Player-Token` after start | room roster, WebSocket liveness/grace, countdown, viewer-safe snapshot |
| `POST /api/v1/rooms/:code/start` | host token | start once at least three total seats exist |
| `POST /api/v1/rooms/:code/actions` | player token | `play`, `draw`, or `call_uno` |
| `DELETE /api/v1/rooms/:code/players/:id` | matching player token | leave; waiting host closes the room, started-game seats become AI |
| `GET /api/v1/rooms/:code/ws?token=...` | player token query | WebSocket snapshot stream |

Example create request:

```json
{
  "name": "Host",
  "max_players": 4,
  "ai_count": 2,
  "countdown_seconds": 15,
  "ai_profile": "garfield1993-ai-hard"
}
```

`max_players` is bounded to 3–10, matching the offline engine. `ai_count` can be
zero, but must leave at least one human seat. Human hands are returned only to
the token's viewer; opponent hands are count-only. A WebSocket disconnect keeps
the player session and seat, marks that seat as AI-controlled, and lets the room
scheduler continue the game. Reconnecting with the same player token restores
human control and the viewer-scoped hand. An explicit REST leave is permanent
for that session and also converts the started seat to AI; if that seat was the
host, host control transfers to the lowest remaining human seat. AI seats
automatically step on the room scheduler.
When a human deadline expires, the server deterministically chooses a legal card
or draws the required cards, then broadcasts the resulting snapshot. Each
snapshot includes `current_player`, `next_player`, and `direction` so clients do
not infer seat order independently. Every state-changing REST request broadcasts
a `room.snapshot` event; AI and timeout changes are broadcast too. The browser
uses WebSocket as its primary transport, reconnects with bounded backoff, and
falls back to bounded REST refresh when an upgrade is unavailable.

WebSocket messages are text JSON envelopes:

```json
{"type":"room.snapshot","room":{"code":"ABCD","status":"playing","snapshot":{}}}
```

The web client sends `max_players`, `ai_count`, `countdown_seconds`, and
`ai_profile` explicitly in snake_case. The Vite dev server proxies `/api` to
`127.0.0.1:8787`; a deployed client must instead set `VITE_ONLINE_API_URL` to
the HTTPS room-service origin.

For refresh recovery, the browser stores only a versioned room code, player id,
player token, host flag, and timestamp in local storage. It does not store a
hand or full snapshot. The lobby offers Reconnect or Cancel and forget; the
latter removes the token so that browser cannot resume that session.

The server sends a protocol-level WebSocket heartbeat every 15 seconds, removes
dead subscribers, and closes obsolete connections shortly after a finished game.
The `/health` response exposes `disconnect_grace_seconds`,
`state_retention_seconds`, and `state_store: "in-memory"`. There is currently no
disk-backed match database: a daily UTC maintenance pass removes records that
have not been updated for six hours, while normal waiting/disconnect/finished
room TTLs are enforced continuously. A restart closes all in-memory rooms.

The service uses a deliberately small HTTP/WebSocket implementation for the
first slice; put it behind TLS and a reverse proxy before exposing it to the
public internet. The Vite dev proxy enables WebSocket forwarding with `ws: true`.
Do not commit room tokens, deployment credentials, or server passwords.
