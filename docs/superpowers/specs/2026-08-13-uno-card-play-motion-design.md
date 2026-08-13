# UNO 2026 card-play motion design

## Goal

Make every played card readable as a physical action: it leaves the source hand or opponent seat, travels toward the central discard pile, turns when an opponent's hidden card is revealed, and lands with a small weighted bounce.

## Scope and ownership

- Rust/WASM remains authoritative for the snapshot, turn order, card identity, and `last_action`.
- React derives a short-lived presentation event by comparing the previous and next snapshots. No rules or card legality move into the animation layer.
- CSS owns the visual interpolation. The DOM overlay is positioned inside `.table-scene`, so the effect scales with the responsive table and never changes document flow.

## Event contract

```ts
type PlayFlight = {
  id: string;
  card: Card;
  playerId: number;
  source: "human" | "ai";
};
```

The event is created only when `last_action` contains `player-<id>-played-`. A human event uses the card selected before the WASM command; an AI event uses the new snapshot's `top_card`. Draws continue to use the existing draw animation and do not create a false play flight.

## Motion sequence

1. **Lift** (0–140 ms): the card leaves its source with a slight scale-up, softened shadow, and a warm highlight.
2. **Travel** (140–680 ms): a curved CSS path moves the card toward the discard pile. A low-opacity gradient trail follows the card.
3. **Reveal** (AI only, 260–520 ms): the card-back face rotates away on the Y axis and the card front rotates into view. Human cards remain face-up.
4. **Impact** (680–900 ms): the card rotates toward level, compresses vertically for one beat, rebounds above the felt, and releases a short elliptical ripple and shadow pulse.
5. **Settle** (900–1,050 ms): the flight layer fades out while the authoritative discard card remains in the pile.

Source paths are semantic rather than pixel-fixed: `human`, `north`, `north-west`, `north-east`, `east`, `west`, `south-east`, and `south-west`. This keeps the same motion language across 3–8 seats and mobile widths.

## Accessibility and performance

- `prefers-reduced-motion: reduce` replaces the path and flip with a short opacity/scale transition while retaining the discard state change.
- The flight layer is `aria-hidden`; the card action remains exposed by the existing button labels and status text.
- Only one flight is rendered at a time, with a 1.05 s timeout and no layout reads in the animation loop.

## Verification

- TypeScript and production Vite build pass.
- Playwright checks the table remains interactive, the flight layer uses the semantic source class, and reduced-motion removes long-running keyframes.
- Screenshots cover desktop and 390 px mobile table layouts, including an AI card-back flip and a human card landing.
