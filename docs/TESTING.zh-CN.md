# 测试指南

[English](TESTING.md) · [开发指南](DEVELOPMENT.zh-CN.md)

## 分层验证

1. `cargo fmt --all -- --check` 检查格式漂移；
2. `cargo test --workspace` 覆盖牌堆形状、3–8 席位构造、合法性、`WildDrawFour` 限制、
   AI 合法性、UNO 喊牌和快照隐私；
3. `npm run typecheck` 检查 WASM 门面和 React 契约；
4. `npm run build` 证明 release 产物和 Vite 包可以生成；
5. `npm run test:browser` 在 1411 端口启动 Vite，检查中文主菜单、设置抽屉默认值、英文切换、
   三人/八人启动、响应式牌桌、弃牌历史开关、摸牌动画状态和联机入口。
6. 本地启动 `uno-server` 后，额外验证 `/health`、创建、加入、开始、退出、TTL 和按玩家
   隔离手牌的集成流程。

## 证据边界

构建通过只证明编译和打包，不证明线上部署；Playwright 通过只证明本地浏览器流程，不证明
联机；Vercel URL 必须在部署后单独检查。不能用一层证据代替另一层。

## 增加规则测试

使用固定 seed，断言玩家可见行为。优先写“规则消失就会失败”的测试，而不是只测内部 helper。
对于有意保留的非标准或临时行为，必须在测试旁边和 `RULES_AND_STATE.zh-CN.md` 中说明。
