# Testing guide

[中文](TESTING.zh-CN.md) · [Development](DEVELOPMENT.md)

## Layers

1. `cargo fmt --all -- --check` catches formatting drift.
2. `cargo test -p uno-core` tests deck shape, legality, WildDrawFour restriction,
   AI legality, UNO calls, and snapshot privacy.
3. `npm run typecheck` checks the WASM facade and React contract.
4. `npm run build` proves the release artifact and Vite bundle can be produced.
5. `npm run test:browser` boots Vite and checks the offline HUD, playable-hand
   surface, draw action, UNO control, and locked online control.

## Evidence discipline

Passing a build proves compilation and packaging, not a live deployment. A passing
Playwright smoke test proves the local browser story, not multiplayer. A Vercel URL
must be checked separately after deployment. Do not report one layer as evidence for
another.

## Adding a rule test

Use a fixed seed and assert player-visible behavior. Prefer a test that would fail if
the rule disappeared over one that only checks an internal helper. When a behavior is
intentionally non-standard or provisional, document that fact beside the test and in
`RULES_AND_STATE.md`.
