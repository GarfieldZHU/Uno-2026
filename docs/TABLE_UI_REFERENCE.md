# UNO 2026 tabletop reference

English | [中文](TABLE_UI_REFERENCE.zh-CN.md)

The live table is intentionally designed as a top-down card table rather than a dashboard:

- `web/public/assets/uno-table-oval-v2.png` is the generated 16:9 walnut-and-felt playfield.
- `web/public/assets/uno-avatar-sheet-v2.png` is the generated four-character portrait sheet used by perimeter seats.
- `web/public/assets/cards/card-back-v2.svg` is the resolution-independent navy/red/gold card back.
- `web/src/CardArt.tsx` draws card fronts as SVG so symbols remain sharp at desktop and mobile sizes.

## 2026 visual pass

The menu, setup surface, drawers, and table now share one restrained material
language: deep jade felt, warm paper/gold for actions, and mint for live state.
The main menu keeps one dominant Start action and groups the less frequent
Online, Settings, and About actions into a compact secondary grid. Setup remains
a single table ticket; it does not turn the opening screen into a dashboard.

The play surface receives the most space. The top information bar is collapsed
by default, the table center remains clear for piles and flight effects, and the
hand rail is a single high-contrast surface with larger SVG cards. Active and
next seats use color and elevation rather than paragraphs of status text. The
same layout rules collapse to one column on narrow screens and keep the card
rail horizontally reachable.

The visual reference is the supplied UNO Offline Google Play surface: players sit around the table, opponent hands are represented by card-back fans, the draw and discard piles share the center, and the human hand is a readable fan along the near edge. The reference informed composition and interaction patterns only; UNO-2026 uses its own generated and authored assets.

Interaction rules:

1. Click the draw pile to draw when it is your turn.
2. Click the discard pile to open the chronological played-card history.
3. Click a lit hand card to play it; wild cards open the color picker.
4. The table exposes only high-signal controls; settings and language remain outside the playfield.
5. The online lobby and table keep a quiet `⌁` control that exports redacted network diagnostics only when clicked; nothing is uploaded.

When assets finish loading, the table runs a 3.8-second initial deal and then
calls out the starting player before enabling input. The play direction is a
translucent, connected SVG arrow ring over the felt (hover a segment to lift
its contrast); the old center direction chip is intentionally not rendered.
Completed games show a persistent win/lose settlement layer with the winner's
name. Animations are state-driven (`deal`, `shuffle`, `draw`, `play`, settlement)
and respect `prefers-reduced-motion`.
