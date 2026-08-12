# AI 档位

[English](AI_PROFILES.md) · [规则与状态](RULES_AND_STATE.zh-CN.md)

所有档位都通过同一个 `choose_move` 边界，只能返回合法出牌或 `Draw`；差别在于如何给
合法牌排序。

| wire 名称 | 家族 | 当前行为 |
| --- | --- | --- |
| `garfield1993-ai-simple` | 兼容档位 | 选择手牌中第一张合法牌 |
| `garfield1993-ai-hard` | 兼容档位 | 评估功能牌、低手牌压力和变色选择 |
| `uno-2026-ai-easy` | 新档位 | 保持简单、容易观察的第一张合法牌策略 |
| `uno-2026-ai-strategist` | 新档位 | 增加对手威胁和双人 Reverse 启发式 |

## 兼容名称

`garfield1993-*` 是有意保留的名称：它们纪念用户指定的历史 AI 档位，并被稳定的 Rust
枚举包住。由于首次实现时无法访问参考仓库，这些是兼容标签，不声称已逐行恢复其内部
启发式。如果之后提供源码压缩包或可访问 checkout，可以在不改 wire 名称的前提下补 parity fixture。

## Hard/strategist 评分

加权选择器会优先功能牌而不是低点数数字牌；AI 接近获胜时提高 `DrawTwo`/`WildDrawFour`
的压力分；变色时选择手中出现次数最多的颜色。strategist 还会考虑手牌很少的对手和双人
`Reverse` 的价值。它仍然是确定性的，不会读取快照中隐藏的对手具体牌面。

## 扩展规则

新增档位时扩展 `AiProfile`、wire 转换和一个评分分支，不要把 AI 决策写进 React。公开到
`web/src/types.ts` 前，先用固定 seed 增加原生测试，证明返回的是合法动作。
