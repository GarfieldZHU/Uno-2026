# UNO 2026 UI design

English | [中文](UI-Design.zh-CN.md)

The current interface uses a quiet tabletop language rather than a dashboard:
deep jade felt, warm paper/gold for actions, and mint for live state. The main
menu has one dominant Start action; Online, Settings, and About stay secondary.
The setup screen is a single table ticket, while the play surface gets the
largest share of the viewport.

The information bar is collapsed by default. The center of the felt remains
clear for draw/discard piles and card-flight effects. The hand is a single
high-contrast rail with resolution-independent SVG cards. Current and next
players are shown by elevation, outline, and short labels; long explanations are
kept in tooltips or accessible text. At narrow widths, the layout becomes one
column and the hand rail remains horizontally reachable.

Implementation reference: [`docs/TABLE_UI_REFERENCE.md`](../docs/TABLE_UI_REFERENCE.md).
