# Testing guide

English | [中文](TESTING.zh-CN.md) · [Development](DEVELOPMENT.md)

## Layers

1. `cargo fmt --all -- --check` catches formatting drift.
2. `cargo test --workspace` tests deck shape, 3–10 seat construction, legality,
   WildDrawFour restriction, AI legality, UNO calls, UNO challenge penalties,
   and snapshot privacy.
3. `pnpm run typecheck` checks the WASM facade and React contract.
4. `pnpm run build` proves the release artifact and Vite bundle can be produced.
5. `pnpm run test:browser` boots Vite on port 1411 and checks the Chinese-first
   main menu, settings drawer defaults, three-seat through ten-seat starts and
   five-to-ten seat route geometry,
   responsive table layout, discard-history open/close, draw animation state,
   the English toggle, online entry, card asset loading, first-click lift/
   second-click or double-click play, drag/drop, hand sorting, wild-color
   selection, direction/current-turn/next-player markers, AI back-to-front
   flight, action effects, seat-aware direction routes and active-turn label,
   action effects, UNO call/challenge affordances, five-second settlement
   actions, exit-table control, and offline settlement.

On a clean machine, install the browser once with
`pnpm exec playwright install --with-deps chromium` before running the browser suite.
6. With `uno-server` listening on `127.0.0.1:8787`, the same command also runs
   `tests/online.spec.ts`: three isolated browser contexts create/join one
   six-seat room with three AI seats, verify viewer-safe hands and SVG assets,
   the seat-to-seat initial deal, the match-record drawer/replay/export,
   and drive the room to a `Won` snapshot in every window. It also asserts that
   all three tables report `data-sync-transport="websocket"` and that a guest
   receives a changed action without waiting for a polling interval. The browser
   suite also verifies that a refresh discovers a stored resume record and that
   Cancel and forget removes it. Rust room tests cover lowest-free seat reuse,
   disconnect-to-AI takeover, same-token control restoration, three-minute
   all-disconnected grace, and six-hour stale-state cleanup.

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
