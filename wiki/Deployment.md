# Deployment

`vercel.json` builds the Vite client into `web/dist`. A production URL is not
part of the repository's evidence until a Vercel deployment reaches `READY` and
the offline WASM flow is checked at that URL. See [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
