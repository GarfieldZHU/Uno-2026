# 部署指南

[English](DEPLOYMENT.md) · [测试](TESTING.md)

## Vercel 静态客户端

仓库根目录的 `vercel.json` 使用 `npm run build` 构建 Vite 客户端，产物是
`web/dist`。离线模式不需要服务端。联机模式需要在 Vercel 项目环境变量中设置
`VITE_ONLINE_API_URL` 为 Rust 服务的 HTTPS 地址；留空时使用同源 `/api/v1`，适合由
反向代理统一转发。

## `uno.alohayo.me`

在 Vercel 的 **GarfieldZHU / Uno-2026** 项目中打开 Settings → Domains，添加
`uno.alohayo.me`。Vercel 会显示该项目实际需要的 DNS 目标；在域名 DNS 服务商处为
`uno` 主机创建它要求的 CNAME，等待验证和 TLS 证书签发。不要用猜测的通用值替代项目
页面显示的记录。官方流程：<https://vercel.com/docs/domains/set-up-custom-domain>。

仓库只能证明默认 Vercel 部署，不能从代码证明 DNS 所有权和自定义域名状态。只有在
Vercel 显示域名已验证、且 HTTPS 请求到达最新 READY 部署后，才能称子域名已上线。

## Rust 房间服务

第一版房间状态只在内存中，适合演示，不是持久化生产匹配服务。Render 免费 Web Service
空闲 15 分钟会休眠、重启会丢本地文件；Fly.io 对新用户不再提供免费层；Railway 的免费
额度是有限实验额度。请以官方限制为准：

- <https://render.com/docs/free>
- <https://fly.io/docs/about/pricing/>
- <https://docs.railway.com/pricing/free-trial>

需要稳定运行时，在已有服务器上用专用非 root 服务账号、systemd 和 HTTPS 反向代理部署
`uno-server`。GitHub Actions 只从 Secrets 读取 `DEPLOY_HOST`、`DEPLOY_USER`、
`DEPLOY_PORT`、`DEPLOY_PRIVATE_KEY`、`DEPLOY_KNOWN_HOSTS`；密码和私钥绝不写入仓库。
GitHub Actions Secrets 官方说明：<https://docs.github.com/en/actions/concepts/security/secrets>。
