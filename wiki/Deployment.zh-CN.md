# 部署

[English](Deployment.md) | 中文

`vercel.json` 使用 `pnpm install --frozen-lockfile` 和 `pnpm run build` 将 Vite 客户端构建到
`web/dist`。仓库已经提供 Vercel 构建契约；只有在
GarfieldZHU 团队中观察到最新部署为 READY 后，才能发布生产地址。详见
[`docs/DEPLOYMENT.zh-CN.md`](../docs/DEPLOYMENT.zh-CN.md)。

联机房间需要在 Vercel 设置 `VITE_ONLINE_API_URL` 指向 HTTPS Rust 服务，并在
GarfieldZHU/Uno-2026 项目的 Domains 中添加 `uno.alohayo.me`，DNS 使用页面显示的项目专属 CNAME。
仓库构建不能证明 DNS 和 TLS 已生效。
