# Design Specification: UNO 2026 Offline Table Redesign

## Status

Approved for implementation on 2026-08-12.

## Goal

Make the offline game feel like a focused, replayable table rather than a
configuration dashboard while keeping Rust authoritative for every rule and
state transition. The browser must let a player start a deterministic local
game with three to eight seats, then play through the existing Rust/WASM
contract.

## Player setup

- Offline games have one human seat (`You`) and two to seven AI seats.
- The player count selector accepts `3`, `4`, `5`, `6`, `7`, or `8`; the
  default is `4`.
- Every AI seat has an independent pause setting from `1` to `30` seconds. A
  newly opened setup screen starts every seat at `3` seconds and offers a
  “set all to 3 seconds” control.
- Pause values are presentation scheduling only. Rust remains responsible for
  whose turn it is and whether an AI move is legal.
- The four existing AI profile identifiers remain available, including the two
  historical compatibility names `garfield1993-ai-simple` and
  `garfield1993-ai-hard`.
- Online mode remains visible as a locked future surface. Its future room model
  can contain multiple human players and any number of AI seats, but no online
  behavior is shipped by this change.

## Visual direction

The table uses a midnight green felt surface with a subtle generated texture,
warm ivory typography, and small cyan/amber highlights for active state. Card
colors remain vivid red, yellow, green, and blue, with wild cards using a dark
prismatic treatment. The setup screen is a calm pre-game ritual; the table
screen gives the playfield the visual priority, keeps controls close to the
human hand, and avoids dashboard-like card grids.

The image asset is original and contains no UNO trademark, logo, or copied
card art. CSS-rendered cards remain the semantic source of truth for card
labels and accessibility.

## Architecture

1. `GameState::new(seed, profile)` keeps its existing four-player behavior for
   native callers and compatibility.
2. `GameState::new_with_player_count(seed, player_count, profile)` clamps the
   domain input to the supported range `3..=8`, creates stable seat names, and
   assigns the human to seat zero with the selected AI profile on the other
   seats.
3. WASM adds `UnoGame::new_with_config(seed, profile, player_count)` while the
   old constructor remains available. TypeScript calls the new constructor and
   falls back to the old one only when using an older generated artifact.
4. React owns setup state, per-seat delay inputs, animation scheduling, and
   route-like screen state. It passes commands to WASM and renders snapshots;
   it never edits cards, turns, or player hands locally.
5. The server stays a disabled `/health` and room-protocol scaffold.

## Verification

- Native Rust tests cover every supported player count, seven-card opening
  hands, stable seat naming, and turn wrapping.
- TypeScript typecheck and production Vite build must pass with the generated
  WASM artifact.
- Playwright covers the setup defaults, custom three-player start, eight-seat
  start, disabled online entry, and the first playable table actions.
- The playtest records setup and table screenshots at desktop and narrow mobile
  widths for visual inspection.

## Acceptance criteria

The redesign is complete when a fresh browser visit opens the setup surface,
shows four seats and three-second AI pauses, starts a valid three-to-eight-seat
offline table, keeps the human hand playable, keeps online disabled, and passes
the repository verification commands without relying on a network service.
