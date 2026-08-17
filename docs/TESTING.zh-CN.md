# 测试指南

[English](TESTING.md) | 中文 · [开发指南](DEVELOPMENT.zh-CN.md)

## 分层验证

1. `cargo fmt --all -- --check` 检查格式漂移；
2. `cargo test --workspace` 覆盖牌堆形状、3–10 席位构造、合法性、`WildDrawFour` 限制、
   AI 合法性、UNO 喊牌、UNO 揭发罚牌和快照隐私；
3. `pnpm run typecheck` 检查 WASM 门面和 React 契约；
4. `pnpm run build` 证明 release 产物和 Vite 包可以生成；
5. `pnpm run test:browser` 在 1411 端口启动 Vite，检查中文主菜单、设置抽屉默认值、英文切换、
   三人到十人启动及五到十席方向路径、响应式牌桌、按座位发牌动画、局内记录查看/回放/导出、弃牌历史、牌面 SVG 加载、首击提牌/二次点击或双击出牌、
   拖拽出牌、手牌整理、野牌选色、方向/当前回合/下一位出牌标识、席位连接箭头、当前回合标签、
   AI 牌背翻牌和动作特效、UNO 喊牌/揭发入口、五秒后结算操作和退出牌桌，以及离线牌局进入结算。
6. 本地启动 `uno-server`（`127.0.0.1:8787`）后，同一命令还会运行 `tests/online.spec.ts`：
   用三个隔离浏览器窗口创建/加入六席房间，配置三个 AI，验证按 token 隔离手牌和卡牌资源，
   并把所有窗口推进到 `Won` 结算快照；同时断言三个牌桌均报告
   `data-sync-transport="websocket"`，且访客能在不等待轮询间隔的情况下收到动作变化；Rust
   房间测试还覆盖最低空闲席位复用、WebSocket 断线转 AI、同 token 重连交还控制权、全断线
   三分钟保护和六小时陈旧状态清理；浏览器测试覆盖刷新后发现恢复记录以及“取消并清除”。

在干净环境首次运行浏览器测试前，先执行
`pnpm exec playwright install --with-deps chromium` 安装 Chromium。

## 证据边界

构建通过只证明编译和打包，不证明线上部署；Playwright 通过只证明本地浏览器流程，不证明
联机；Vercel URL 必须在部署后单独检查。不能用一层证据代替另一层。

## 增加规则测试

使用固定 seed，断言玩家可见行为。优先写“规则消失就会失败”的测试，而不是只测内部 helper。
对于有意保留的非标准或临时行为，必须在测试旁边和 `RULES_AND_STATE.zh-CN.md` 中说明。
