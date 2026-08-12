# 原版仓库与纪念说明

[English](ORIGINAL_REPOSITORY.md) · [项目索引](README.zh-CN.md)

## 历史链接

- 主仓库：<https://github.com/1411-duliu/Uno>
- 历史 hard-AI 分支：<https://github.com/1411-duliu/Uno/tree/ai_hard/Uno>

原版是一个基于 C++ 的 UNO 游戏。UNO 2026 以新的运行时延续它：Rust 负责确定性规则，
WebAssembly 支持离线浏览器运行，React/TypeScript 提供清晰牌桌。`garfield1993-ai-simple`
和 `garfield1993-ai-hard` 两个名称是两代项目之间的有意桥梁。

## 哪些内容已验证、哪些没有

首次实现环境无法解析 GitHub DNS，因此没有成功克隆或阅读原版仓库。我们不声称已经完成
源码级复刻、恢复原版目录结构，或恢复其私有 AI 启发式。当前实现依据本仓库记录的标准
UNO 规则，并明确保留来源边界。

如果以后可以访问原版源码，负责的下一步应是只读审计：映射其牌堆/回合模型和 AI 决策，
为可观察行为增加 parity fixture，并记录每个有意差异。未确认许可证和作者授权前，不复制
原版代码或素材。

## 为什么保留链接？

小型旧游戏也是开发者历史的一部分。保留原版链接可以让作者继续被看见，让维护者有地方
比较思路，也让这次重写成为一种纪念，而不是抹去起点。新项目可以现代化载体，但不假装
第一版从未存在。
