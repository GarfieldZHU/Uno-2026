# 贡献指南

[English](CONTRIBUTING.md) · [开发指南](DEVELOPMENT.zh-CN.md)

## 修改前

阅读 `AGENTS.md`、最近的模块文档和对应双语页面。保留无关本地文件，不加入受保护的
UNO 艺术素材、第三方凭据，也不能在没有证据时声称已线上部署。

## Pull Request 形态

- 说明玩家可见行为以及事实来源模块；
- 规则变更带测试，UI 变更带浏览器检查；
- 公共契约变化同步英文和简体中文文档；
- 说明与历史仓库的任何有意差异；
- 不提交生成的 `target/`、`node_modules/`、`web/dist/` 和测试结果。

## 必跑检查

```bash
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
npm run test:browser
```
