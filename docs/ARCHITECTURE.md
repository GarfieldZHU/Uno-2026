# Architecture

[中文](ARCHITECTURE.zh-CN.md) · [Documentation index](README.en.md)

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

server/  future transport boundary only
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
| `web/src/App.tsx` | table composition, input, AI pacing | authoritative state mutation |
| `web/src/SetupScreen.tsx` | offline seat/profile/pause setup | card or turn rules |
| `web/src/types.ts` | TypeScript view types and labels | rule decisions |
| `web/src/wasm.ts` | lazy browser module loading | fallback rule engine |
| `web/src/styles.css` | visual language and responsive layout | game state |
| `server/src/main.rs` | health/protocol placeholder | enabled multiplayer authority |

## State flow

1. `SetupScreen` collects 3–8 seats (default four), the AI profile, and each
   AI seat's 1–30 second presentation pause (default three).
2. `App` creates `UnoGame.new_with_config(seed, profile, player_count)` only
   after the offline start action.
3. Rust creates a deterministic 108-card deck, shuffles it with the supplied
   seed, deals seven cards to every configured seat, and starts on a numeric
   discard.
4. The facade returns a JSON `Snapshot`; AI hands are intentionally omitted from
   the public snapshot while their counts remain visible.
5. A human command (`play_card`, `draw`, or `call_uno`) is validated by Rust.
6. AI turns call `ai_step` with the configured UI delay. The delay is presentation only;
   the choice is deterministic inside Rust.
7. A terminal snapshot reports `status: "Won"` and `winner`.

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
