# Server protocol boundary

[中文](SERVER_PROTOCOL.zh-CN.md) · [Architecture](ARCHITECTURE.md)

`server/` is intentionally a small Rust TCP/HTTP scaffold, not a playable online
service. It binds `UNO_SERVER_ADDR` (default `127.0.0.1:8787`) and currently exposes:

| Route | Response | Meaning |
| --- | --- | --- |
| `GET /health` | `200` JSON | process health and scaffold mode |
| `GET /api/v1/rooms` | `503` JSON | multiplayer is explicitly disabled |
| anything else | `404` JSON | no route exists yet |

Before enabling rooms, define and test authentication, room ownership, authoritative
hidden hands, command sequencing, reconnects, rate limits, and a versioned protocol.
The server must reuse the Rust domain rather than reimplementing rules in handlers.

Run the scaffold with:

```bash
cargo run -p uno-server
curl http://127.0.0.1:8787/health
```

Do not advertise `/api/v1/rooms` as an available feature until it returns a tested
room contract instead of `multiplayer-disabled`.
