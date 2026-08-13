# Deployment

`vercel.json` builds the Vite client into `web/dist`. The verified production URL is
[uno-2026-garfieldzhus-projects.vercel.app](https://uno-2026-garfieldzhus-projects.vercel.app/);
the page reaches the offline table and loads the Rust/WASM HUD. See
[`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

For rooms, set `VITE_ONLINE_API_URL` to the HTTPS Rust origin. Add
`uno.alohayo.me` under the GarfieldZHU/Uno-2026 Vercel project Domains settings
and use the project-specific CNAME shown there.
