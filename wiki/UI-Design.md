# UNO 2026 UI design

English | [中文](UI-Design.zh-CN.md)

The current interface uses a quiet tabletop language rather than a dashboard:
deep jade felt, warm paper/gold for actions, and mint for live state. The main
menu has one dominant Start action; Online, Settings, and About stay secondary.
The setup screen is a single table ticket, while the play surface gets the
largest share of the viewport.

The information bar is collapsed by default. The center of the felt remains
clear for draw/discard piles and card-flight effects. The hand is a single
high-contrast rail with resolution-independent SVG cards. Direction is drawn as
seat-aware SVG routes; each connector is trimmed before the seat cards and
carries one arrowhead at its geometric midpoint, so it reads as a player-to-player
edge without covering an avatar. The current-to-next route is a gold animated connector,
and the next seat is labelled `NEXT TO PLAY` instead of an ambiguous shorthand.
Current and next players are shown by elevation, outline, and short labels; the
current seat uses the strongest gold treatment while the next seat is deliberately
quieter. Reverse and skip actions briefly overlay the affected and next players;
the UNO-ready action grows, a successful call shouts from the avatar, and the
offending seat exposes `CHALLENGE UNO` during the interstitial phase. At narrow
widths, the layout becomes one column and the hand rail remains horizontally reachable.
Phone and tablet layouts spend the viewport height on a fitted table-and-hand
stack with document overflow disabled; landscape reduces secondary labels,
seat cards, piles, and hand cards, while the heading remains the single turn
cue. Medium browser windows use a separate desktop-scale single-column stack
so the table remains flexible without shrinking seats, piles, or hand cards into
an unreadable compact mode. Active north/south seats retain their center anchor,
and SVG card edges are not surrounded by a second dark inset frame.

The human draw interaction is private: a back travels from the pile, flips to
the resolved face, and the inserted card glows for two seconds. Other clients
only receive the public count update. Finished tables reveal play-again/exit
actions after five seconds and keep a compact exit control in the top-right corner.

The opening deal is measured rather than guessed: the animation reads the
rendered draw-pile rectangle and each rendered seat/hand slot, then sends the
backs to those coordinates. The human hand displays `0/N` while cards arrive
back-side up and reveals the SVG faces only after the final card lands. This
keeps the 3.8-second opening readable across responsive layouts and seat counts.

Implementation reference: [`docs/TABLE_UI_REFERENCE.md`](../docs/TABLE_UI_REFERENCE.md).
