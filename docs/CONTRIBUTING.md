# Contributing

[中文](CONTRIBUTING.zh-CN.md) · [Development](DEVELOPMENT.md)

## Before a change

Read `AGENTS.md`, the nearest module documentation, and the relevant bilingual
page. Keep unrelated local files untouched. Do not add protected UNO artwork,
third-party credentials, or claims of live deployment without evidence.

## Pull request shape

- explain the player-visible behavior and the source-of-truth module;
- include tests for rule changes and a browser check for UI changes;
- update both English and Simplified Chinese docs when a public contract changes;
- mention any intentional divergence from the historical repository;
- keep generated `target/`, `node_modules/`, `web/dist/`, and test results out of commits.

## Required checks

```bash
cargo fmt --all -- --check
cargo test -p uno-core
npm run typecheck
npm run build
npm run test:browser
```
