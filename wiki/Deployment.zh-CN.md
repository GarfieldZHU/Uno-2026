# 部署

`vercel.json` 将 Vite 客户端构建到 `web/dist`。已验证的生产地址是
[uno-2026-garfieldzhus-projects.vercel.app](https://uno-2026-garfieldzhus-projects.vercel.app/)，
页面可进入离线牌桌并加载 Rust/WASM HUD。详见 [`docs/DEPLOYMENT.zh-CN.md`](../docs/DEPLOYMENT.zh-CN.md)。

联机房间需要在 Vercel 设置 `VITE_ONLINE_API_URL` 指向 HTTPS Rust 服务，并在
GarfieldZHU/Uno-2026 项目的 Domains 中添加 `uno.alohayo.me`，DNS 使用页面显示的项目专属 CNAME。
