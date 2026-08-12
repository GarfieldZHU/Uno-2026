# UNO 2026 牌桌视觉参考

当前牌桌刻意采用俯视卡牌桌，而不是仪表盘：

- `web/public/assets/uno-table-oval-v2.png`：生成的 16:9 胡桃木与绿色绒布牌桌。
- `web/public/assets/uno-avatar-sheet-v2.png`：生成的四角色头像图集，用于四周席位。
- `web/public/assets/cards/card-back-v2.svg`：可无损缩放的藏蓝、红色、金色卡背。
- `web/src/CardArt.tsx`：用 SVG 绘制牌面，让桌面和移动端的符号都保持清晰。

视觉参考来自用户提供的 Google Play UNO Offline 牌桌：玩家围绕牌桌分布，对手用卡背扇表示手牌，摸牌堆和弃牌堆共享中央区域，人类手牌沿近侧形成扇形。这里只参考构图和交互习惯；UNO-2026 使用自己生成和编写的资源。

交互规则：

1. 自己回合点击摸牌堆摸牌。
2. 点击弃牌堆打开按时间排序的已出牌历史。
3. 点击发光的手牌出牌；万能牌会打开选色器。
4. 牌桌只保留高信号操作；设置和语言切换留在牌桌外层。

动画由状态驱动（`shuffle`、`draw`、`play`），并遵守 `prefers-reduced-motion`。
