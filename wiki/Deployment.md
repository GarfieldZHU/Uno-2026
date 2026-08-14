# Deployment

English | [中文](Deployment.zh-CN.md)

`vercel.json` runs `pnpm install --frozen-lockfile` and `pnpm run build` to build the Vite
client into `web/dist`. The repository contains the
Vercel build contract; a live READY deployment must be verified in the GarfieldZHU
team before publishing a production URL. See
[`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

For rooms, set `VITE_ONLINE_API_URL` to the HTTPS Rust origin. Add
`uno.alohayo.me` under the GarfieldZHU/Uno-2026 Vercel project Domains settings
and use the project-specific CNAME shown there. DNS and TLS are not proven by a
repository build.
