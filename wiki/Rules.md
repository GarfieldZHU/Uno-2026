# Rules

English | [中文](Rules.zh-CN.md)

The table uses a classic 108-card deck, three to ten seven-card hands (four by
default), numeric opening discard, color/symbol matching, action cards, wild colors, a non-stacking draw
penalty, draw-pile recycling, and a two-card missed-UNO penalty. Playing to one
card opens the `uno_pending_player` interstitial: the owner can call UNO and
another player can challenge before the next turn clock starts. The pending
count is shown as a chain badge and forced draws animate from spread card backs
into the affected player's hand; the animation does not alter the rules. AI hands
are hidden from the public snapshot. See [`docs/RULES_AND_STATE.md`](../docs/RULES_AND_STATE.md)
for the exact current behavior.
