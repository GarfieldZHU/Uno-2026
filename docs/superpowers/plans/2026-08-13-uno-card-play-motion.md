# UNO card-play motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive, event-driven card flight effect for human and AI plays, including opponent card-back reveal, curved travel, gradient trail, weighted landing, and reduced-motion fallback.

**Architecture:** Rust/WASM remains the only game authority. React compares the previous and next snapshot/event boundary and creates one short-lived `PlayFlight` presentation object. A DOM overlay inside `.table-scene` renders the card-back/front faces and CSS owns the path, flip, impact ripple, shadow compression, and cleanup; the authoritative discard pile remains visible underneath as the settled state.

**Tech Stack:** React 19, TypeScript, CSS keyframes/custom properties, Playwright, Vite, Rust/WASM snapshot contract.

## Global Constraints

- Keep the existing Rust/WASM game contract and `Snapshot.last_action` semantics unchanged.
- Use semantic source slots (`human`, `north`, `north-west`, `north-east`, `east`, `west`, `south-east`, `south-west`) instead of pixel-fixed DOM coordinates.
- Render at most one flight at a time and clean it after 1.05 seconds.
- Keep the flight layer `aria-hidden`; state and action buttons remain accessible through existing labels/status text.
- `prefers-reduced-motion: reduce` must retain the state transition while replacing long path/flip keyframes with a short opacity/scale transition.
- Preserve the default-hidden topbar behavior and the existing generated/project-owned card assets.
- All commits and pushes use the repository-local GarfieldZHU identity.

---

### Task 1: Add the flight presentation component and event types

**Files:**
- Create: `web/src/PlayFlight.tsx`
- Modify: `web/src/types.ts`
- Test: `web/src/PlayFlight.test.tsx` (if the repository adds a component test runner; otherwise cover the public contract in Playwright Task 4)

**Interfaces:**
- Produces `PlayFlightEvent = { id: string; card: Card; playerId: number; source: PlayFlightSource }`.
- `PlayFlight` accepts `{ flight: PlayFlightEvent; language: Language }` and renders `data-testid="play-flight"`, `data-source`, and `data-player-id`.

- [x] **Step 1: Define the semantic source type.**

```ts
export type PlayFlightSource =
  | "human"
  | "north"
  | "north-west"
  | "north-east"
  | "east"
  | "west"
  | "south-east"
  | "south-west";

export type PlayFlightEvent = {
  id: string;
  card: Card;
  playerId: number;
  source: PlayFlightSource;
};
```

- [x] **Step 2: Render both faces without adding input controls.**

```tsx
<div className={`play-flight play-flight-${flight.source} ${flight.source === "human" ? "is-human" : "is-opponent"}`} data-testid="play-flight" data-source={flight.source} data-player-id={flight.playerId} aria-hidden="true">
  <span className="play-flight-trail" />
  <span className="play-flight-card">
    <img className="play-flight-back" src="/assets/cards/card-back-v2.svg" alt="" />
    <span className="play-flight-front"><CardArt card={flight.card} language={language} compact /></span>
  </span>
  <span className="play-flight-shadow" />
  <span className="play-flight-ripple" />
</div>
```

- [x] **Step 3: Run the typecheck.**

Run: `npm run typecheck`

Expected: PASS; the new component and types compile before App integration.

- [x] **Step 4: Commit the isolated component.**

```bash
git add web/src/PlayFlight.tsx web/src/types.ts
git commit -m "feat: add card flight presentation component"
```

### Task 2: Derive human and AI play events at the WASM boundary

**Files:**
- Modify: `web/src/App.tsx`
- Modify: `web/src/types.ts` (only if Task 1 exposes a missing shared type)

**Interfaces:**
- `showPlayFlight(card, playerId)` sets one `PlayFlightEvent` and schedules cleanup.
- `sourceForPlayer(playerId, playerCount)` maps player 0 to `human` and AI IDs through `SEAT_LAYOUTS`.
- `playedPlayerId(lastAction)` parses only the existing `player-<id>-played-...` wire form and returns `number | null`.

- [x] **Step 1: Add a failing Playwright assertion for the human event.**

Extend `tests/offline.spec.ts` after starting a table: click an enabled `.hand-card`, handle the wild-color dialog if it appears, then assert `page.getByTestId("play-flight")` has `data-source="human"` and `data-player-id="0"`.

- [x] **Step 2: Run the focused test and observe the failure.**

Run: `npx playwright test tests/offline.spec.ts --grep "出牌飞行"`

Expected: FAIL because no `play-flight` element exists yet.

- [x] **Step 3: Add event state and cleanup.**

```tsx
const [playFlight, setPlayFlight] = useState<PlayFlightEvent | null>(null);
const flightTimerRef = useRef<number | null>(null);

const showPlayFlight = useCallback((card: Card, playerId: number) => {
  if (flightTimerRef.current !== null) window.clearTimeout(flightTimerRef.current);
  setPlayFlight({
    id: `${playerId}-${card.id}-${Date.now()}`,
    card,
    playerId,
    source: sourceForPlayer(playerId, snapshot?.players.length ?? 4),
  });
  flightTimerRef.current = window.setTimeout(() => {
    setPlayFlight(null);
    flightTimerRef.current = null;
  }, 1_050);
}, [snapshot?.players.length]);
```

- [x] **Step 4: Emit human events before replacing the snapshot.**

`handlePlay` and `handleWildColor` call `showPlayFlight(card, HUMAN_ID)` immediately before `applyRaw(...)`; the selected card object is retained even though Rust removes it from the next human hand.

- [x] **Step 5: Emit AI events only for played actions.**

In `runAiTurns`, after `parseSnapshot(gameRef.current.ai_step())`, parse `result.snapshot.last_action`. If `playedPlayerId(...)` is non-null, call `showPlayFlight(result.snapshot.top_card, aiPlayerId)` before `setSnapshot`. AI draws continue to trigger only the existing draw animation.

- [x] **Step 6: Render the overlay inside `.table-scene`.**

Place `{playFlight && <PlayFlight flight={playFlight} language={language} />}` as the last child of `.felt-table.table-scene`, so the flight stays above the felt and below history/modal surfaces.

- [x] **Step 7: Run the focused human test.**

Run: `npx playwright test tests/offline.spec.ts --grep "出牌飞行"`

Expected: PASS with `data-source="human"` and `data-player-id="0"`.

- [x] **Step 8: Commit the state integration.**

```bash
git add web/src/App.tsx tests/offline.spec.ts
git commit -m "feat: emit card flight events for human and AI plays"
```

### Task 3: Implement path, flip, gradient trail, and weighted impact styling

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/src/PlayFlight.tsx` only if a class/data attribute needs to be exposed

**Interfaces:**
- Each `.play-flight-*` source class runs a 1.05 s path animation from its semantic seat to the center.
- `.is-opponent .play-flight-card` rotates on the Y axis from card back to card front; `.is-human` remains face-up.

- [x] **Step 1: Add the 3D face stack and trail primitives.**

Use `perspective`, `transform-style: preserve-3d`, `backface-visibility: hidden`, a blurred linear-gradient trail, and a separate shadow element. Keep the overlay `position:absolute; inset:0; pointer-events:none; z-index:8`.

- [x] **Step 2: Add the shared flight/impact keyframes.**

Implement `card-flight-human`, `card-flight-north`, `card-flight-north-west`, `card-flight-north-east`, `card-flight-east`, `card-flight-west`, `card-flight-south-east`, and `card-flight-south-west`. Each path ends at `translate(-50%, -50%)`; the final 20% includes a small rotation correction and scale squash/rebound. Add `card-flight-trail`, `card-flight-shadow`, `card-flight-ripple`, and `card-flight-flip` keyframes.

- [x] **Step 3: Keep the stable discard card visually behind the incoming card.**

While `.table-scene:has(.play-flight)` is active (with a class fallback if needed), reduce the stable discard card opacity and increase its shadow only during the 1.05 s overlay.

- [x] **Step 4: Add reduced-motion rules.**

Under `@media (prefers-reduced-motion: reduce)`, disable path/flip/trail keyframes and use `opacity: 0 → 1`, `transform: translate(-50%, -50%) scale(.92 → 1)`, and a short ripple fade.

- [x] **Step 5: Run build and inspect a desktop screenshot.**

Run: `npm run typecheck && npm run build`

Expected: PASS; no layout shift outside the table scene.

- [x] **Step 6: Commit the motion styling.**

```bash
git add web/src/styles.css
git commit -m "feat: add physical card landing motion"
```

### Task 4: Cover AI reveal, mobile behavior, and reduced motion in browser tests

**Files:**
- Modify: `tests/offline.spec.ts`

**Interfaces:**
- Tests observe only public DOM data attributes and user-visible actions; no internal timer or React state is mocked.

- [x] **Step 1: Add AI reveal coverage.**

Configure the settings drawer to 1-second AI pauses, make one legal human play, wait for `.play-flight[data-source="north-west"]`, and assert `.play-flight-back` and `.play-flight-front` are both present. Capture `test-results/offline-ai-play-flight.png`.

- [x] **Step 2: Add mobile flight coverage.**

Set viewport to 390×844, start a table, make a legal human play, assert the flight bounding box stays within the `.table-scene` bounding box, and capture `test-results/offline-human-play-flight-mobile.png`.

- [x] **Step 3: Add reduced-motion coverage.**

Create a context with `reducedMotion: "reduce"`, start a table, make a legal human play, and assert the flight exists while `getComputedStyle(flight).animationDuration` is `0.01ms` or less.

- [x] **Step 4: Run the complete browser suite.**

Run: `npm run test:browser`

Expected: all existing offline menu/settings/history/language tests plus the three motion checks pass.

- [x] **Step 5: Commit test evidence.**

```bash
git add tests/offline.spec.ts test-results/offline-ai-play-flight.png test-results/offline-human-play-flight-mobile.png
git commit -m "test: verify human and AI card flight motion"
```

### Task 5: Final verification and publication

**Files:**
- Modify: `docs/README.en.md` and `docs/README.zh-CN.md` with a short link to the motion spec if needed.

- [x] **Step 1: Run the full verification gate.**

```bash
git diff --check
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
npm run test:browser
```

- [x] **Step 2: Verify identity and worktree.**

```bash
git config user.name
git config user.email
git status --short
git log -1 --format='%an <%ae>%n%cn <%ce>%n%s'
```

Expected identity: `GarfieldZHU <garfield.bupt@gmail.com>` for both author and committer; no unrelated files changed.

- [x] **Step 3: Push the verified commits.**

```bash
git push origin main
git ls-remote origin refs/heads/main
```

- [ ] **Step 4: Validate the production page.**

The repository is pushed to GarfieldZHU/Uno-2026 at `5ad0030`. Vercel validation is pending because the connected GarfieldZHU team currently exposes no Uno project through the available API, the previous Uno hostname redirects to Vercel authentication, and the local CLI has no active credentials. Do not report a production URL as updated until the project is linked and a READY deployment is observed.

Open the authenticated Vercel production URL, start an offline table, trigger a human play, and visually confirm the flight, AI card-back flip, impact ripple, and stable discard state on desktop and mobile-sized viewports.
