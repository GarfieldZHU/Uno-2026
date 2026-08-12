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

## Honest status

This file documents the configuration, not a live deployment. A completion report
may include a URL only after a real Vercel deployment reaches `READY`, the page loads
the WASM module, and the offline smoke flow is checked at that URL. A local build or
an existing Vercel project is not proof of production availability.

## Preview checklist

- the build command completes without falling back to a missing WASM artifact;
- `/wasm/uno_core.js` and its `.wasm` file return successfully;
- the offline table reaches `YOUR HAND` and the online control remains locked;
- a mobile viewport still exposes the hand rail and draw/UNO actions;
- no secret or server credential is required by the static app.
