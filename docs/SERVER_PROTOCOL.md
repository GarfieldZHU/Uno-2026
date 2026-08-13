# Server protocol

[中文](SERVER_PROTOCOL.zh-CN.md) · [Architecture](ARCHITECTURE.md)

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

The default room TTL is 15 minutes. Codes are four uppercase characters from a
non-ambiguous alphabet. Human turn timeouts are clamped to 5–30 seconds and
default to 15 seconds. Existing UNO rules remain in `crates/uno-core`; handlers
never duplicate card legality or effects.

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /health` | none | process health |
| `POST /api/v1/rooms` | none | create a room; returns code, player token, seats, AI count, timeout |
| `POST /api/v1/rooms/:code/players` | none | join a waiting room; returns player id/token |
| `GET /api/v1/rooms/:code` | `X-Player-Token` after start | room roster, expiry, countdown, viewer-safe snapshot |
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

`max_players` is bounded to 3–8, matching the offline engine. `ai_count` can be
zero, but must leave at least one human seat. Human hands are returned only to
the token's viewer; opponent hands are count-only. If a player leaves after the
game starts, that seat remains in the turn ring and is immediately controlled by
the configured AI profile; if that seat was the host, host control transfers to
the lowest remaining human seat. AI seats automatically step on the room scheduler.
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

The service uses a deliberately small HTTP/WebSocket implementation for the
first slice; put it behind TLS and a reverse proxy before exposing it to the
public internet. The Vite dev proxy enables WebSocket forwarding with `ws: true`.
Do not commit room tokens, deployment credentials, or server passwords.
