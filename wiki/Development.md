# Development

English | [中文](Development.zh-CN.md)

Run `cargo test --workspace`, `pnpm run typecheck`, `pnpm run build`, and
`pnpm run test:browser`. Install dependencies with `corepack enable && pnpm install`.
Rules belong in Rust; UI changes belong in React/CSS;
public contract changes update both languages. Read `AGENTS.md` before using an
agent. See [`docs/DEVELOPMENT.md`](../docs/DEVELOPMENT.md).
