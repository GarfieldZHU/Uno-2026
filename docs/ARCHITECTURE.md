# Architecture

English | [中文](ARCHITECTURE.zh-CN.md) · [Documentation index](README.en.md)

## Ownership model

```text
React + TypeScript UI
        │ user commands / JSON snapshots
        ▼
wasm-bindgen facade (UnoGame)
        │
        ▼
crates/uno-core
  cards → state → rules/effects → AI → snapshot

server/  authoritative in-memory room transport
```

The Rust domain is the source of truth. A browser `UnoGame` owns one
`GameState`; every UI action calls an exported method and receives a serialized
snapshot. React never removes a card, advances a turn, or applies a penalty on its
own. This keeps native tests and browser behavior on the same implementation.

## Directory responsibilities

| Path | Responsibility | Must not own |
| --- | --- | --- |
| `crates/uno-core/src/cards.rs` | colors, card kinds, card identity, deck vocabulary | DOM or browser APIs |
| `crates/uno-core/src/state.rs` | deck, hands, turn, effects, penalties, snapshots | CSS, network sessions |
| `crates/uno-core/src/ai.rs` | deterministic move selection | UI timing or random browser state |
| `crates/uno-core/src/lib.rs` | public Rust exports and wasm-bindgen facade | duplicated game rules |
| `web/src/App.tsx` | table composition, input, AI pacing, presentation animation | authoritative state mutation |
| `web/src/MainMenuScreen.tsx` | low-chrome Chinese-first menu and language control | game configuration state |
| `web/src/SettingsDrawer.tsx` | offline seat/profile/pause configuration | card or turn rules |
| `web/src/AboutPanel.tsx` | project lineage and original-repository link | game state |
| `web/src/CardArt.tsx` | resolution-independent SVG card renderer | rule decisions |
| `web/src/DiscardHistory.tsx` | ordered discard-history dialog | game mutation |
| `web/src/i18n.ts` | Chinese/English UI copy and engine-message localization | rules or snapshot state |
| `web/src/types.ts` | TypeScript view types and labels | rule decisions |
| `web/src/wasm.ts` | lazy browser module loading | fallback rule engine |
| `web/src/styles.css` | visual language and responsive layout | game state |
| `server/src/main.rs` | process lifecycle, listener, scheduler thread | room rules or HTTP parsing |
| `server/src/room.rs` | room authority, waiting/disconnect TTLs, token-scoped snapshots, AI scheduler, subscriber broadcast, resume control | socket framing or DOM |
| `server/src/http.rs` | request parsing, CORS, REST routing, WebSocket upgrade dispatch | game rules or room mutation |
| `server/src/websocket.rs` | RFC 6455 handshake, frames, subscriber lifecycle | room rules or browser UI |

## State flow

1. `MainMenuScreen` renders Chinese by default with only Start game, Settings, and About. `SettingsDrawer`
   collects 3–8 seats (default four), the AI profile, and each AI seat's 1–30 second presentation pause (default three).
2. `App` creates `UnoGame.new_with_config(seed, profile, player_count)` only
   after the offline start action.
3. Rust creates a deterministic 108-card deck, shuffles it with the supplied
   seed, deals seven cards to every configured seat, and starts on a numeric
   discard.
4. The facade returns a JSON `Snapshot`; AI hands are intentionally omitted from
   the public snapshot while their counts remain visible. `discard_cards` is an
   ordered oldest-to-newest list used by the table's on-demand history dialog.
5. A human command (`play_card`, `draw`, or `call_uno`) is validated by Rust.
6. AI turns call `ai_step` with the configured UI delay. The delay is presentation only;
   the choice is deterministic inside Rust.
7. A terminal snapshot reports `status: "Won"` and `winner`.

Online adds a session boundary around the same `GameState`: the room owns human
tokens, AI seats, waiting/disconnect expiry, turn deadlines, and subscriber
channels; each REST request or WebSocket broadcast asks the domain for a snapshot
scoped to its viewer. WebSocket is the primary browser transport, with a server
heartbeat, bounded-backoff reconnect, and REST retained for commands/fallback
refresh. A started-game leave or socket disconnect keeps the seat in the ring and
changes its control to AI; the same token reconnect restores human control and
the viewer hand. Live sockets remove the started-room TTL; an all-disconnected
room gets three minutes to resume. Finished sockets are closed after the final
snapshot. Snapshots publish `current_player`, `next_player`, and `direction` as
authoritative order data. The first deployment is intentionally in-memory, so
restart durability is not implied; a daily UTC retention pass removes stale
records after six hours without updates.

## Determinism

The deck shuffle uses an explicit `u64` seed and a local xorshift-style sequence.
The AI does not sample browser randomness. Given the same seed, profile, and
command sequence, the native and WASM domains should produce the same snapshots.
Parity is a project invariant; a future parity fixture should compare native JSON
to browser JSON before changing the exported schema.

## Why not put the rules in React?

The original goal is a Rust rules implementation that can serve both offline WASM
and a future server. Duplicating legality or effects in the UI would create two
authorities and make online parity harder. React is therefore a view/controller,
not a simulation.
