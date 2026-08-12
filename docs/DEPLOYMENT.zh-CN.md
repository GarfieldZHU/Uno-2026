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

## 诚实的状态说明

本文档只说明配置，不等同于线上部署。只有当真实 Vercel 部署达到 `READY`、页面成功加载
WASM、并在该线上 URL 验证离线流程后，完成报告才能提供 URL。一次本地构建或存在一个
Vercel 项目都不代表线上可用。

## Preview 检查清单

- 构建成功，且不是因为缺少 WASM 而跳过；
- `/wasm/uno_core.js` 和对应 `.wasm` 文件都能返回；
- 离线牌桌出现 `YOUR HAND`，联机控件仍是锁定状态；
- 手机视口仍能使用手牌轨道和摸牌/UNO 操作；
- 静态应用不需要任何 secret 或服务端凭据。
