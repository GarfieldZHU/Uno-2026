# UNO 2026 tabletop reference

English | [中文](TABLE_UI_REFERENCE.zh-CN.md)

The live table is intentionally designed as a top-down card table rather than a dashboard:

- `web/public/assets/uno-table-oval-v2.jpg` is the optimized generated 16:9 walnut-and-felt playfield (the original PNG remains in the asset folder for source-quality review).
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
3. Click a lit hand card once to lift it, click again (or double-click) to play it; drag it
   to the felt for a deliberate play. Wild cards open the color picker.
4. The table exposes only high-signal controls; settings and language remain outside the playfield.
5. The online lobby and table keep a quiet `⌁` control that exports redacted network diagnostics only when clicked; nothing is uploaded.

When assets finish loading, the table runs a 3.8-second initial deal from the
centre pile to the perimeter seats and then calls out the starting player before
enabling input. The play direction is a translucent, seat-aware SVG route over
the felt. Each route connects one player to the next in the active direction;
the current player-to-next-player route uses a gold animated stroke, while the
other routes remain quiet. Hovering a route lifts its contrast; the old center
direction chip is intentionally not rendered. The next-seat label reads
`NEXT TO PLAY`/`下一位出牌` so it describes the action rather than relying on
an ambiguous “next” shorthand.

The route geometry is generated from the same seat resolver as the players:
3–10 seat layouts use a shallow lower pair for nine and ten seats, and the SVG
rail emits exactly one segment per live seat. The active arrow is therefore the
authoritative current-player → next-player edge rather than a fixed eight-seat
overlay.

When the human player draws, only that client sees a private draw reveal: a
card back travels from the draw pile, flips to the resolved SVG face, and
settles into the hand. The inserted card keeps a two-second glow so the new
card is easy to find. Other clients receive the public hand-count update but
never see another player's card face.
Completed games show a persistent win/lose settlement layer with the winner's
name. Animations are state-driven (`deal`, `shuffle`, `draw`, `play`, settlement)
and respect `prefers-reduced-motion`.

The quiet match-record button beside the network diagnostics button opens the
observed snapshot timeline. It records public state only (not hidden opponent
cards), highlights each event during local replay, and downloads a JSON record
that can be archived or inspected without uploading it.
