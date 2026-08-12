# 部署指南

[English](DEPLOYMENT.md) · [测试指南](TESTING.zh-CN.md)

## Vercel 形态

`vercel.json` 声明了 Vite 构建：

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "web/dist"
}
```

部署必须从本仓库根目录运行。`npm run build` 先保证 WASM 产物存在，再把 `web/` 构建到
`web/dist`。离线客户端不需要服务端运行时。

## 已验证的生产状态

当前生产客户端位于
[uno-2026-garfieldzhus-projects.vercel.app](https://uno-2026-garfieldzhus-projects.vercel.app/)。
已在认证后的部署页面核验：页面进入离线牌桌、加载 Rust/WASM HUD，并按设计保持联机房间锁定。
修改 Vercel 项目或构建设置后，应重新执行这项核验。

## Preview 检查清单

- 构建成功，且不是因为缺少 WASM 而跳过；
- `/wasm/uno_core.js` 和对应 `.wasm` 文件都能返回；
- 离线牌桌出现 `YOUR HAND`，联机控件仍是锁定状态；
- 手机视口仍能使用手牌轨道和摸牌/UNO 操作；
- 静态应用不需要任何 secret 或服务端凭据。
