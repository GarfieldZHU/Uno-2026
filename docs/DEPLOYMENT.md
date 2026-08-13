# Deployment guide

[中文](DEPLOYMENT.zh-CN.md) · [Testing](TESTING.md)

## Static client on Vercel

`vercel.json` builds the Vite client from the repository root:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "web/dist"
}
```

The client can run offline without a server. For online rooms set
`VITE_ONLINE_API_URL` in the Vercel project environment to the HTTPS origin of
the Rust service (for example `https://api.example.com`). An empty value uses a
same-origin `/api/v1` path, which is useful behind a reverse proxy.

## `uno.alohayo.me`

In Vercel, add `uno.alohayo.me` to the **GarfieldZHU / Uno-2026** project under
Settings → Domains. Vercel will show the project-specific DNS target. At the DNS
provider, create the requested CNAME for the `uno` host, then wait for Vercel to
verify it and issue TLS. Do not substitute a generic target if the dashboard
shows a project-specific one. The official flow is documented at
<https://vercel.com/docs/domains/set-up-custom-domain>.

The repository can prove the default Vercel deployment, but DNS ownership and
custom-domain readiness are external state. Only call the subdomain live after
Vercel reports the domain verified and an HTTPS request reaches the latest READY
deployment.

## Rust room service

The first online slice keeps rooms in memory and is therefore suitable for a
demo, not durable production matchmaking. Render's free web services can host a
Rust HTTP process but sleep after 15 minutes idle and lose local files on restart;
Fly.io no longer offers a new-user free tier, and Railway's free credit is a
limited experiment. See the official limits before choosing one:

- <https://render.com/docs/free>
- <https://fly.io/docs/about/pricing/>
- <https://docs.railway.com/pricing/free-trial>

For reliable use, deploy `uno-server` on an existing server with a dedicated
non-root service account, systemd, and an HTTPS reverse proxy. Keep
`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_PRIVATE_KEY`, and
`DEPLOY_KNOWN_HOSTS` in GitHub Actions Secrets; never put a password or private
key in this repository. GitHub encrypts Actions secrets and supports protected
production environments: <https://docs.github.com/en/actions/concepts/security/secrets>.
