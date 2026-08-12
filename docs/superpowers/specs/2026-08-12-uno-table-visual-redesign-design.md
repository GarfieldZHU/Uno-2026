# UNO-2026 Offline Table Visual Redesign

**Date:** 2026-08-12
**Status:** Approved design, ready for implementation planning
**Scope:** Offline React/WASM experience; online mode remains a disabled scaffold.

## Goal

Replace the current form-heavy setup and dashboard-like table with a focused card-game flow that is readable in Chinese by default, switchable to English, and faithful to the supplied tabletop reference without copying protected artwork.

## Experience direction

- **Fantasy:** a warm, premium tabletop card room rather than a settings dashboard.
- **Material language:** midnight green felt, mahogany edge, ivory paper cards, restrained brass accents, and colored UNO action glyphs.
- **Typography:** a strong display face for the UNO title and a highly legible system sans for controls and status text.
- **Motion:** short, deliberate deal, draw, play, and shuffle transitions; no perpetual decorative motion. All non-essential motion is disabled or shortened under `prefers-reduced-motion`.
- **Playfield protection:** the table center and lower-middle remain clear during normal play. Secondary content opens only on demand.

## Screen model

### 1. Main menu

The initial screen contains only:

- `开始游戏` / `Start game` (primary action)
- `设置` / `Settings`
- `关于` / `About`

Language switching is a compact top-corner control, not a fourth large menu card. A generated hero background and code-native SVG UNO wordmark establish the visual identity. No player-count or AI controls are visible on this screen.

### 2. Settings drawer

The drawer owns the existing offline configuration:

- player count, constrained to 3–8 and defaulting to 4;
- AI profile;
- default pause, constrained to 1–30 seconds and defaulting to 3;
- per-seat pause overrides;
- language toggle and a close/apply action.

`开始游戏` uses the current settings and transitions directly to the table. Closing the drawer without starting leaves the menu visible.

### 3. About panel

The panel stays lightweight and contains the project lineage, the memorial link to the original C++ repository, the current offline/WASM status, and the online-mode placeholder status. It must not cover the table because it is only reachable from the menu.

### 4. Table

The table is a full-window felt surface with low chrome:

- compact status/turn strip at the top edge;
- opponent seats distributed around the perimeter with avatar initials, names, and hand counts;
- central draw pile and discard pile;
- human hand anchored to the bottom edge;
- contextual controls for draw, call UNO, and wild-color choice only when actionable;
- a small exit-to-menu affordance, without a persistent settings panel.

The discard pile is a button. Activating it opens a history surface showing every discarded card in chronological order, with the newest card emphasized. The history surface can be closed without mutating game state.

## Component boundaries

- `MainMenuScreen`: title/hero, three menu actions, language control.
- `SettingsDrawer`: configuration controls and validation; reuses the current `SetupOptions` contract.
- `AboutPanel`: localized project context and legacy-repository link.
- `TableScreen` (in `App.tsx` initially): table layout and action wiring.
- `CardArt`: SVG card front/back renderer. Card faces are generated from typed card data, so every card is resolution-independent and consistent.
- `DiscardHistory`: accessible dialog/drawer for the snapshot discard history.
- `AnimationLayer`: a small state machine for `deal`, `draw`, `play`, and `shuffle` classes; it does not own game state.

The Rust/WASM engine remains authoritative. The UI only renders snapshots and submits commands. The snapshot contract gains an ordered `discard_cards` list so the history view never reconstructs rules from presentation state.

## Asset plan

1. Generate a new project-bound hero/effect bitmap with the built-in image generation tool. It will be a wide, text-free table-room composition with negative space for the SVG title; the result is copied into `web/public/assets/` under a versioned filename.
2. Add code-native SVG resources for the card back, title wordmark, glow/sparkle accents, and reusable card geometry. SVG is preferred for card art because it must remain crisp at mobile and high-DPI sizes.
3. Keep the existing felt texture untouched. New files use versioned names so rollback is trivial.

## State and data flow

```text
Rust UnoGame
  -> Snapshot { players, top_card, discard_cards, ... }
  -> React table renderer
  -> CardArt / player rails / discard history

user gesture -> App command wrapper -> WASM method -> new Snapshot
                                      -> animation state (presentation only)
```

`discard_cards` is ordered from oldest to newest and includes the current top card. Hidden opponent hands remain hidden exactly as they are today.

## Error handling and accessibility

- Invalid player counts and pauses are clamped in the existing configuration layer.
- A missing WASM artifact keeps the current build-time fallback/error behavior; the redesign does not hide engine failures.
- Buttons use real button semantics, visible focus rings, and localized labels.
- The discard-history surface traps neither game input nor focus beyond what is needed for a dismissible dialog.
- Color is never the only card cue: each card keeps its symbol/number and text label.
- `prefers-reduced-motion` disables card flight and glow pulses while preserving state-change feedback.

## Verification gate

The feature is complete only when all of the following pass:

1. Rust formatting and `cargo test -p uno-core`.
2. TypeScript typecheck and Vite production build.
3. Browser smoke coverage for:
   - Chinese-first main menu and English toggle;
   - settings drawer with 3–8 players and 1–30 second pauses;
   - starting a table from the menu;
   - discard pile opening and closing history;
   - a play/draw state applying the corresponding animation class;
   - desktop and narrow mobile table screenshots.
4. Manual screenshot review confirms that the table center remains unobstructed and the menu no longer resembles a settings dashboard.

## Explicit non-goals

- No online matchmaking or server protocol implementation in this slice.
- No replacement of the Rust rules engine with client-side rules.
- No copying of third-party character portraits, logos, or proprietary UNO artwork.
- No permanent multi-panel HUD on the live table.
