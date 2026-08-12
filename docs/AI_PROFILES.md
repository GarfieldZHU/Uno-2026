# AI profiles

[中文](AI_PROFILES.zh-CN.md) · [Rules and state](RULES_AND_STATE.md)

All profiles implement the same `choose_move` boundary and can return only a
legal play or `Draw`. They differ in how they rank legal cards.

| Wire name | Family | Current behavior |
| --- | --- | --- |
| `garfield1993-ai-simple` | compatibility | chooses the first legal card in hand |
| `garfield1993-ai-hard` | compatibility | scores action cards, low-hand pressure, and color choice |
| `uno-2026-ai-easy` | new reference | keeps the simple, readable first-legal behavior |
| `uno-2026-ai-strategist` | new reference | adds opponent threat and two-player reverse heuristics |

## Compatibility names

The `garfield1993-*` names are intentional. They acknowledge the requested
historical AI modes while keeping the implementation behind a stable Rust enum.
Because the referenced legacy repository was not reachable from the initial build
environment, these names are compatibility labels, not a claim that its private
heuristics were line-by-line recovered. If an archive or accessible checkout is
provided, parity fixtures can be added without changing the public wire names.

## Hard/strategist scoring

The weighted chooser prefers action cards over low-value number cards, gives extra
pressure to `DrawTwo`/`WildDrawFour` when the AI is close to winning, and selects a
color that appears most often in its hand. The strategist profile additionally
accounts for a threatened opponent and two-player `Reverse` value. It remains
deterministic and does not inspect hidden opponent card contents in the snapshot.

## Extension rule

Add a profile by extending `AiProfile`, its wire conversion, and one scoring branch;
do not add AI decisions to React. Add a native test that proves the profile returns
a legal move for a fixed seed before exposing it in `web/src/types.ts`.
