# Development

English | [中文](Development.zh-CN.md)

Run `cargo test --workspace`, `pnpm run typecheck`, `pnpm run build`, and
`pnpm run test:browser`. Install dependencies with `corepack enable && pnpm install`.
Rules belong in Rust; UI changes belong in React/CSS;
public contract changes update both languages. Read `AGENTS.md` before using an
agent. `pnpm-workspace.yaml` allows only the Vite-required `esbuild` build script;
other dependency install scripts remain blocked by pnpm's supply-chain guard.
See [`docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md).
