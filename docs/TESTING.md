# Testing guide

[中文](TESTING.zh-CN.md) · [Development](DEVELOPMENT.md)

## Layers

1. `cargo fmt --all -- --check` catches formatting drift.
2. `cargo test --workspace` tests deck shape, 3–8 seat construction, legality,
   WildDrawFour restriction, AI legality, UNO calls, and snapshot privacy.
3. `npm run typecheck` checks the WASM facade and React contract.
4. `npm run build` proves the release artifact and Vite bundle can be produced.
5. `npm run test:browser` boots Vite on port 1411 and checks the Chinese-first
   main menu, settings drawer defaults, three-seat and eight-seat starts,
   responsive table layout, discard-history open/close, draw animation state,
   the English toggle, online entry, card asset loading, drag/drop, wild-color
   selection, AI back-to-front flight, and offline settlement.
6. With `uno-server` listening on `127.0.0.1:8787`, the same command also runs
   `tests/online.spec.ts`: three isolated browser contexts create/join one
   six-seat room with three AI seats, verify viewer-safe hands and SVG assets,
   and drive the room to a `Won` snapshot in every window.

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
