# UNO 2026 Wiki 镜像

[English](README.md) | 中文

这里是 GitHub Wiki 的双语审阅源。Wiki 页面与主仓库分开维护；获得发布授权后，
将对应文件同步到 `GarfieldZHU/Uno-2026.wiki`。

## 页面

- [首页](Home.zh-CN.md)
- [架构](Architecture.zh-CN.md)
- [规则](Rules.zh-CN.md)
- [AI 档位](AI-Profiles.zh-CN.md)
- [WASM 契约](WASM-Contract.zh-CN.md)
- [开发](Development.zh-CN.md)
- [部署](Deployment.zh-CN.md)
- [历史与纪念](History.zh-CN.md)

## 文档约定

公共契约、玩家可见行为和命令变化必须同时更新英文与简体中文页面。仓库默认使用
pnpm 11 和提交的 `pnpm-lock.yaml`；临时外部 CLI 默认写 `bunx`，并在注释中保留
`npx` 回退。Wiki 不得把本地测试、Vercel 静态响应或未验证的服务器状态写成生产保证。
