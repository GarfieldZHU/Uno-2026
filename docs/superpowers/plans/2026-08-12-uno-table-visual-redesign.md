# UNO-2026 Offline Table Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-heavy offline flow with a Chinese-first UNO main menu, settings drawer, and focused animated tabletop while adding crisp SVG card resources and a discard-history view.

**Architecture:** Rust `uno-core` remains authoritative and exposes an ordered `discard_cards` array in every snapshot. React owns only screen state, presentation animation state, and modal/drawer visibility; `MainMenuScreen`, `SettingsDrawer`, `AboutPanel`, `CardArt`, and `DiscardHistory` remain focused components. Vite serves project-bound generated hero art and code-native SVG assets from `web/public/assets/`.

**Tech Stack:** Rust + serde + wasm-bindgen, React 19 + TypeScript, CSS, Vite, Playwright, built-in image generation tool.

## Global Constraints

- Default UI language is Chinese; English remains switchable from a compact language control.
- Offline player count is 3–8, default 4; AI pause is 1–30 seconds, default 3.
- Online mode remains visibly disabled and must not be presented as working.
- The table center and lower-middle remain unobstructed during normal play.
- Card faces and backs use resolution-independent SVG; generated raster art is versioned and must not replace the existing felt texture.
- All commits and pushes use `GarfieldZHU <garfield.bupt@gmail.com>`.
- Use `apply_patch` for source edits; do not add third-party dependencies.
- Every task ends with its focused test or inspection command before the next task begins.

---

### Task 1: Expose discard history from the authoritative Rust snapshot

**Files:**
- Modify: `crates/uno-core/src/state.rs:28-65,351-385`
- Modify: `crates/uno-core/src/lib.rs:143-160`
- Modify: `web/src/types.ts:12-31`

**Interfaces:**
- Produces `Snapshot.discard_cards: Vec<SnapshotCard>` in oldest-to-newest order, including `top_card`.
- TypeScript consumes the JSON field as `discard_cards: Card[]`.

- [ ] **Step 1: Write the failing Rust contract assertion**

Add to `snapshot_is_stable_json_for_the_frontend_boundary`:

```rust
assert_eq!(snapshot.discard_cards.len(), snapshot.discard_count);
assert_eq!(snapshot.discard_cards.last().unwrap().id, snapshot.top_card.id);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cargo test -p uno-core snapshot_is_stable_json_for_the_frontend_boundary`

Expected: compile failure because `Snapshot` has no `discard_cards` field.

- [ ] **Step 3: Implement the snapshot field**

Add `pub discard_cards: Vec<SnapshotCard>` to `Snapshot` and populate it with `self.discard_pile.iter().map(SnapshotCard::from).collect()` immediately beside `top_card` in `GameState::snapshot`.

- [ ] **Step 4: Update the browser type and run the focused Rust test**

Add `discard_cards: Card[]` to `Snapshot`, then run:

```bash
cargo fmt --all -- --check
cargo test -p uno-core snapshot_is_stable_json_for_the_frontend_boundary
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add crates/uno-core/src/state.rs crates/uno-core/src/lib.rs web/src/types.ts
git commit -m "feat: expose discard history in UNO snapshots"
```

### Task 2: Add red browser acceptance tests for the new screen flow

**Files:**
- Modify: `tests/offline.spec.ts`

**Interfaces:**
- Tests expect `data-testid="main-menu"`, `data-testid="settings-drawer"`, `data-testid="about-panel"`, `data-testid="discard-history"`, and `data-animation` on the table root.

- [ ] **Step 1: Replace setup-first assertions with menu-first assertions**

Add tests that assert a fresh visit shows Chinese `开始游戏`, `设置`, and `关于`, with no visible player-count select until settings opens. Keep English-toggle coverage.

- [ ] **Step 2: Add settings drawer coverage**

Open `设置`, assert `data-testid="settings-drawer"`, select 3 and set default pause to 1, close it, then start the table and assert `3 席`.

- [ ] **Step 3: Add discard history and animation coverage**

Start a four-seat table, assert the discard pile is a button, click it, assert `data-testid="discard-history"` and at least one card, close it, then click an enabled human action and assert the table briefly exposes `data-animation="play"` or `data-animation="draw"`.

- [ ] **Step 4: Run the new tests and verify they fail**

Run: `pnpm run test:browser -- tests/offline.spec.ts`

Expected: failures because the new screen and test IDs do not exist yet.

- [ ] **Step 5: Commit the red tests**

```bash
git add tests/offline.spec.ts
git commit -m "test: define UNO menu and tabletop acceptance flow"
```

### Task 3: Create high-resolution visual assets and code-native SVG card art

**Files:**
- Create: `web/public/assets/uno-menu-hero-v2.png` (generated)
- Create: `web/public/assets/cards/card-back.svg`
- Create: `web/public/assets/cards/uno-title.svg`
- Create: `web/public/assets/cards/sparkle.svg`
- Create: `web/src/CardArt.tsx`

**Interfaces:**
- `CardArt({ card, language, compact, className })` renders an accessible SVG front at any DPR.
- `card-back.svg` is a standalone reusable back resource for CSS/HTML fallback.

- [ ] **Step 1: Generate the hero bitmap with the built-in image tool**

Use a wide 2048×1152 prompt with deep green felt, mahogany rim, orbiting red/yellow/green/blue cards, controlled glow, generous empty center, no text, no logos, and no watermark. Copy the selected output into `web/public/assets/uno-menu-hero-v2.png`; do not overwrite `uno-felt-texture.png`.

- [ ] **Step 2: Inspect and validate the generated asset**

Use `view_image` at original/high detail. Reject or regenerate if the center is busy, card edges are muddy, the palette is too bright behind white title text, or any text/watermark appears.

- [ ] **Step 3: Add deterministic SVG resources**

Create the card back, UNO title, and sparkle with gradients, explicit `viewBox`, no external fonts/images, and `aria-hidden="true"` when decorative.

- [ ] **Step 4: Implement `CardArt` from typed card data**

Use SVG `<text>` for number/action labels and four color wedges for wild cards. Keep the existing `Card` fields as the only source of truth and include the localized `aria-label` on the outer element.

- [ ] **Step 5: Inspect the SVGs in the browser**

Run `pnpm run dev --host 127.0.0.1`, open the app, and verify card corners, labels, glyphs, and back contrast at desktop and mobile sizes. Stop the server after inspection.

- [ ] **Step 6: Commit assets**

```bash
git add web/public/assets/uno-menu-hero-v2.png web/public/assets/cards web/src/CardArt.tsx
git commit -m "feat: add vector UNO card art and menu hero"
```

### Task 4: Build the Chinese-first main menu, settings drawer, and about panel

**Files:**
- Create: `web/src/MainMenuScreen.tsx`
- Create: `web/src/SettingsDrawer.tsx`
- Create: `web/src/AboutPanel.tsx`
- Modify: `web/src/SetupScreen.tsx` (extract configuration form into drawer-compatible component)
- Modify: `web/src/i18n.ts`
- Modify: `web/src/App.tsx`

**Interfaces:**
- `MainMenuScreen({ language, onLanguageChange, onStart, onOpenSettings, onOpenAbout, error })`.
- `SettingsDrawer({ initialConfig, language, open, onClose, onApply })` owns only editable configuration state.
- `AboutPanel({ language, open, onClose })` has a localized legacy link to `https://github.com/1411-duliu/Uno` and describes the memorial lineage without claiming copied assets.

- [ ] **Step 1: Implement the failing menu shell**

Add the new components and make `App` render `MainMenuScreen` by default. Keep the current `SetupConfig` shape and defaults unchanged.

- [ ] **Step 2: Move configuration controls behind the drawer**

Reuse player count, profile, default pause, and per-seat pause controls inside `SettingsDrawer`; ensure 3–8 and 1–30 constraints stay enforced. Closing preserves edits only when the user applies them.

- [ ] **Step 3: Add localized menu/about copy**

Add Chinese and English keys for menu actions, drawer labels, about text, memorial link, and visual status. Chinese remains the initial `language` state.

- [ ] **Step 4: Run menu/settings browser tests**

Run: `pnpm run test:browser -- tests/offline.spec.ts -g "menu|settings|language"`

Expected: those tests pass while discard/animation tests remain pending.

- [ ] **Step 5: Commit**

```bash
git add web/src/MainMenuScreen.tsx web/src/SettingsDrawer.tsx web/src/AboutPanel.tsx web/src/SetupScreen.tsx web/src/i18n.ts web/src/App.tsx
git commit -m "feat: add UNO main menu and settings drawer"
```

### Task 5: Refocus the table and add discard history plus presentation animation

**Files:**
- Create: `web/src/DiscardHistory.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/CardArt.tsx`
- Modify: `web/src/i18n.ts`
- Modify: `web/src/types.ts`

**Interfaces:**
- `DiscardHistory({ cards, language, open, onClose })` renders an accessible dialog with chronological cards.
- `App` presentation state uses `"deal" | "draw" | "play" | "shuffle" | null` and clears itself after a bounded timeout.

- [ ] **Step 1: Add a failing history component test path**

Wire the discard button to `DiscardHistory` using `snapshot.discard_cards`; expose the newest card with an explicit “latest” label and a close button.

- [ ] **Step 2: Add animation state around command wrappers**

Set `deal`/`shuffle` after table creation, `play` after successful play/AI step, and `draw` after draw. Apply `data-animation` to the felt-table root and preserve it for at least one animation frame/short timeout so Playwright can observe it.

- [ ] **Step 3: Replace CSS-only card markup in the table**

Use `CardArt` for draw, discard, and hand cards. Keep draw as the only clickable deck action and discard as a separate history button.

- [ ] **Step 4: Run discard and animation tests**

Run: `pnpm run test:browser -- tests/offline.spec.ts -g "discard|animation"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/DiscardHistory.tsx web/src/App.tsx web/src/CardArt.tsx web/src/i18n.ts web/src/types.ts
git commit -m "feat: add discard history and tabletop motion"
```

### Task 6: Apply the tabletop visual system and responsive/reduced-motion behavior

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/src/App.tsx`
- Modify: `web/src/MainMenuScreen.tsx`
- Modify: `web/src/SettingsDrawer.tsx`
- Modify: `web/src/DiscardHistory.tsx`

**Interfaces:**
- Menu uses `uno-menu-hero-v2.png` plus `uno-title.svg`.
- Table uses a single felt surface, perimeter seats, center piles, bottom hand, and contextual controls.

- [ ] **Step 1: Add menu and drawer styles**

Use CSS variables for deep felt, mahogany, ivory, brass, and UNO action colors. Keep the menu to three large actions and avoid equal-weight dashboard cards.

- [ ] **Step 2: Add table layout and card readability styles**

Use `clamp()` for card dimensions, strong ivory/ink contrast, visible playable glow, and a center pile target of at least 44px. Keep player count and status as compact edge chips.

- [ ] **Step 3: Add motion classes**

Implement `table-animation-deal`, `table-animation-shuffle`, `table-animation-play`, and `table-animation-draw` with short keyframes. Add `@media (prefers-reduced-motion: reduce)` to remove transforms and glow pulses.

- [ ] **Step 4: Add desktop/mobile breakpoints**

At narrow widths, collapse perimeter labels to initials, keep both piles visible, make the human hand horizontally scrollable, and keep the history surface dismissible without covering the whole table.

- [ ] **Step 5: Run typecheck and production build**

Run:

```bash
pnpm run typecheck
pnpm run build
```

Expected: PASS, with no generated WASM changes unless the build explicitly requires them.

- [ ] **Step 6: Commit styles**

```bash
git add web/src/styles.css web/src/App.tsx web/src/MainMenuScreen.tsx web/src/SettingsDrawer.tsx web/src/DiscardHistory.tsx
git commit -m "feat: polish UNO menu and felt tabletop UI"
```

### Task 7: Complete browser playtest, visual quality review, and publish

**Files:**
- Modify: `tests/offline.spec.ts` only if a verified selector or timing fix is needed.
- Modify: `README.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md` only if the new menu/history flow changes user-facing instructions.

- [ ] **Step 1: Run the complete verification gate**

```bash
cargo fmt --all -- --check
cargo test -p uno-core
pnpm run typecheck
pnpm run build
pnpm run test:browser
```

- [ ] **Step 2: Run the game playtest against the real dev port**

Start `pnpm run dev --host 127.0.0.1` and use Playwright at port `1411` to verify boot, menu actions, settings, start, human play/draw, discard history, language switching, and return-to-menu. Capture desktop 1440×1000 and mobile 390×844 screenshots.

- [ ] **Step 3: Inspect screenshots for quality**

Reject the result if card labels are clipped, the active card is indistinguishable from the background, the title competes with menu actions, any permanent panel obscures the center, or the mobile hand cannot be reached. Fix only the owning component/style and rerun the affected test.

- [ ] **Step 4: Verify Vercel configuration and GitHub identity**

Confirm `vercel.json` still uses `pnpm run build` and `web/dist`, `git config user.name` is `GarfieldZHU`, and the final branch commits all show GarfieldZHU as author and committer. Do not use `jiazhu_mstr` in this repository.

- [ ] **Step 5: Commit final docs/test adjustments and push**

```bash
git add .
git commit -m "test: verify UNO visual table flow"
git push origin main
git ls-remote origin refs/heads/main
```

Expected: remote `main` resolves to the final GarfieldZHU commit and the Vercel-linked project can build from the repository.
