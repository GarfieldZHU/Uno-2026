# Implement UNO 2026 offline table redesign

> **For the implementation agent:** REQUIRED SUB-SKILL: Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Ship a polished offline setup/table flow with 3–8 seats, per-AI
pause controls, dynamic Rust/WASM state, original visual assets, and a passing
browser playtest.

**Architecture:** Preserve the existing Rust `GameState`/`UnoGame` authority
and old four-player constructor, add a bounded player-count constructor, and
keep all delay values in React as scheduling configuration. Use the existing
Vite React app and CSS-rendered cards, with one generated felt texture asset.

**Tech stack:** Rust, wasm-bindgen, React, TypeScript, Vite, Playwright, pnpm.

## Task 1: Add variable offline player counts in Rust

**Files:** `crates/uno-core/src/state.rs`, `crates/uno-core/src/lib.rs`

1. Add failing native tests for counts 3 through 8, seven-card opening hands,
   stable seat names, and turn wrapping.
2. Run `cargo test -p uno-core` and observe the missing constructor failure.
3. Implement `GameState::new_with_player_count`; keep `new` delegating to four
   seats and clamp the public domain input to 3–8.
4. Add `UnoGame::new_with_config` while preserving `UnoGame::new`.
5. Run `cargo fmt --all -- --check` and `cargo test -p uno-core`.

## Task 2: Update the WASM/frontend contract

**Files:** `web/src/wasm.ts`, `web/src/types.ts`

1. Extend the TypeScript constructor typing with the new WASM constructor and a
   compatibility fallback.
2. Add typed player-count and AI-delay constants used by setup controls.
3. Run `pnpm run typecheck` to catch contract drift before UI work.

## Task 3: Build the setup flow and scheduling model

**Files:** `web/src/App.tsx`, optionally `web/src/SetupScreen.tsx`

1. Add a setup screen as the initial state with defaults of four seats and three
   seconds per AI seat.
2. Render seat-specific pause inputs for all AI seats and a reset-all control.
3. Start WASM only after the offline start action, passing the selected count.
4. Make the AI loop use the current seat's configured pause in milliseconds;
   retain a bounded loop and cancel work on unmount/restart.
5. Keep the online button disabled and make table restart preserve setup values.

## Task 4: Redesign the visual surface and add original asset

**Files:** `web/src/styles.css`, `web/public/assets/uno-felt-texture.png`,
`web/src/App.tsx`

1. Generate and inspect an original seamless midnight-felt texture with the
   image-generation skill; copy only the approved raster asset into the repo.
2. Replace the dashboard-like layout with a responsive setup ritual and a
   centered felt table, preserving readable card semantics and focus states.
3. Make the opponent rail, playfield, hand, and action bar adapt to narrow
   screens without shrinking the play surface into an unusable grid.

## Task 5: Add browser coverage and perform the playtest

**Files:** `tests/offline.spec.ts`

1. Add failing Playwright checks for setup defaults and the disabled online
   entry, then run the browser test to confirm the old immediate-table behavior
   fails the new expectations.
2. Add checks for three-seat and eight-seat starts and first playable actions.
3. Capture desktop and mobile setup/table screenshots and inspect them for
   clipping, contrast, focus visibility, and playfield protection.

## Task 6: Refresh public documentation and verify the release

**Files:** bilingual README/docs/wiki mirrors as needed

1. Document player-count and pause settings, the offline/online boundary, and
   the 1411 development port in English and Simplified Chinese.
2. Run the full gate: Rust fmt/tests, TypeScript typecheck, production build,
   and Playwright browser tests.
3. Run `git diff --check`, verify the local GarfieldZHU identity, commit with a
   focused message, and push to the configured GarfieldZHU remote.
