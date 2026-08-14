# Online network diagnostics

English | [中文](NETWORK_DIAGNOSTICS.zh-CN.md)

The online lobby and table expose a quiet `⌁` control in the lower-right
corner. Clicking it downloads `uno-2026-network-<timestamp>.json` so a player
can attach a compact network report when investigating stalls or reconnects.

## What is recorded

- WebSocket lifecycle: attempts, handshake duration, open/close, close code,
  errors, reconnect count, and backoff delay.
- Message metadata: message type, count, byte count, and whether a room
  snapshot was present. Message bodies are never retained.
- REST metadata: method, redacted route, status, duration, response size, and
  visible `x-vercel-id`/`server` edge markers.
- Browser network capabilities: `navigator.onLine`, effective connection type,
  connection type, estimated RTT/downlink, Save-Data, visibility, viewport, and
  device pixel ratio.
- Topology clues available to a browser: public page/API/WebSocket origins,
  same-origin versus configured-service routing, and navigation DNS/TCP/TLS/
  request/response timings.

A browser cannot reliably expose a local routing table, Wi-Fi SSID, LAN peers,
or public IP to this application. The report does not invent those fields;
public origins and edge markers are enough to distinguish the Vercel page,
reverse proxy, and Rust room service in most bottleneck investigations.

## Redaction boundary

The exporter omits or removes room codes, player tokens, authentication
headers, names, hands, decks, complete snapshots, request/response bodies,
`token`/`player_token` query values, passwords, deployment keys, and environment
variables. The report is generated locally and is never uploaded automatically.
Review the JSON before sharing in case a browser extension or custom proxy adds
its own fields.

## Sharing a report

1. Click `⌁` while the stall, fallback, or reconnect is occurring.
2. Keep the generated filename and note the time, browser/device, network type,
   and whether the report came from the lobby or table.
3. Attach the JSON to a private issue or maintainer message rather than posting
   it publicly without review.

This is diagnostic metadata, not a deterministic game replay. Rust snapshots
remain authoritative for rules and table state.
