# Server protocol

[中文](SERVER_PROTOCOL.zh-CN.md) · [Architecture](ARCHITECTURE.md)

`server/` is now a small Rust authoritative room service. It keeps room state
in memory, reuses `uno-core` for deck/rules/AI, and is intentionally stateless
at the HTTP edge. A restart closes all active rooms; durable matchmaking and
authentication are outside this first online slice.

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
| `DELETE /api/v1/rooms/:code/players/:id` | matching player token | leave; host departure closes the room |

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
the token's viewer; opponent hands are count-only. AI seats automatically step
on room polling, while an expired human deadline draws for that player.

The service uses a deliberately small HTTP implementation for the first slice;
put it behind TLS and a reverse proxy before exposing it to the public internet.
Do not commit room tokens, deployment credentials, or server passwords.
