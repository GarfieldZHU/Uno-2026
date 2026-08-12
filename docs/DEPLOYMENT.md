# Deployment guide

[中文](DEPLOYMENT.zh-CN.md) · [Testing](TESTING.md)

## Vercel shape

`vercel.json` declares a Vite build:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "web/dist"
}
```

The deployment must run from this repository root. `npm run build` first ensures a
WASM artifact exists, then builds the `web/` app into `web/dist`. No server runtime
is required for the offline client.

## Verified production status

The current production client is available at
[uno-2026-garfieldzhus-projects.vercel.app](https://uno-2026-garfieldzhus-projects.vercel.app/).
The page was checked from the authenticated deployment surface: it reaches the
offline table, loads the Rust/WASM HUD, and keeps online rooms locked. Repeat the
check after changing the Vercel project or build settings.

## Preview checklist

- the build command completes without falling back to a missing WASM artifact;
- `/wasm/uno_core.js` and its `.wasm` file return successfully;
- the offline table reaches `YOUR HAND` and the online control remains locked;
- a mobile viewport still exposes the hand rail and draw/UNO actions;
- no secret or server credential is required by the static app.
