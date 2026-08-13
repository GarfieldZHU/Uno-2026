# Implementation plan

1. Define a deterministic Rust domain: 108-card deck, legal move checks, action effects, draw-pile recycling, UNO call/penalty, winner detection, and JSON snapshots.
2. Add four deterministic AI profiles behind one decision interface.
3. Export the domain through `wasm-bindgen`, keep generated bindings under the web build boundary, and retain the native test suite as the source-level contract.
4. Build the React table shell: mode launcher, HUD, opponents, card components, color picker, keyboard-safe actions, and responsive hand.
5. Add the Rust room service, CI, Vercel configuration, and browser smoke test.
6. Run Rust, TypeScript, production build, and browser checks; commit locally and publish when the requested GitHub owner is writable.
