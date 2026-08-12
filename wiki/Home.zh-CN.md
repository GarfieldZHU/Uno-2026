# UNO 2026

Rust 规则、WebAssembly 离线运行时、React 牌桌。

UNO 2026 是一个确定性的浏览器 UNO 游戏，拥有可原生测试的 Rust 核心和响应式
TypeScript HUD。当前支持的是离线牌桌；联机房间留到后续协议里程碑，UI 仍保持锁定。

主菜单只提供开始游戏、设置和关于。设置抽屉支持 3–8 个离线席位（默认四人），由一名人类和 AI
席位组成；每个 AI 都可单独设置 1–30 秒停顿（默认三秒）。牌桌使用 SVG 卡牌，提供短促的发牌、摸牌、出牌、洗牌动画，
并可按需打开按时间排序的弃牌历史。未来联机房间允许混合多名人类和任意数量 AI，但目前尚未开启。

界面默认使用中文；`EN` 按钮可以在不重启牌局的情况下，将菜单、设置抽屉和游戏 HUD 切换为英文。

## 启动

```bash
npm install
npm run dev
```

## 导航

- [架构](Architecture.zh-CN.md)
- [规则](Rules.zh-CN.md)
- [AI 档位](AI-Profiles.zh-CN.md)
- [WASM 契约](WASM-Contract.zh-CN.md)
- [开发](Development.zh-CN.md)
- [部署](Deployment.zh-CN.md)
- [历史](History.zh-CN.md)

完整说明见[英文项目指南](../docs/README.en.md)和[中文项目说明](../docs/README.zh-CN.md)。
