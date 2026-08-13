# UNO 2026

Rust 规则、WebAssembly 离线运行时、React 牌桌。

UNO 2026 是一个确定性的浏览器 UNO 游戏，拥有可原生测试的 Rust 核心和响应式
TypeScript HUD。当前支持离线牌桌和第一版 Rust REST/轮询房间：四位房间码、15 分钟有效期、
混合人类/AI 席位、房主开始/关闭和按 token 隔离手牌；服务仍是内存演示。

主菜单只提供开始游戏、设置和关于。设置抽屉支持 3–8 个离线席位（默认四人），由一名人类和 AI
席位组成；每个 AI 都可单独设置 1–30 秒停顿（默认三秒）。牌桌使用 SVG 卡牌，提供短促的发牌、摸牌、出牌、洗牌动画，
并可按需打开按时间排序的弃牌历史。联机流程允许混合多名人类和 AI，房主离开会立即关闭房间；
公开使用前需要配置 Rust 服务地址并放在 TLS 后。

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
