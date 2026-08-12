# UNO 2026

Rust rules. WebAssembly offline runtime. React table.

UNO 2026 is a deterministic browser UNO game with a native-testable Rust core and
a responsive TypeScript HUD. The offline table is the supported experience. Online
rooms are reserved for a later protocol milestone and remain locked in the UI.

The setup surface supports 3–8 offline seats (four by default), one human plus
AI seats, and an independent 1–30 second pause for every AI seat (three by
default). The future online room model is allowed to mix multiple humans with
any number of AI, but is not enabled yet.

Chinese is the default interface language. The `EN` control switches both the
setup surface and the in-game HUD to English without restarting the table.

## Start

```bash
npm install
npm run dev
```

## Navigate

- [Architecture](Architecture.md)
- [Rules](Rules.md)
- [AI Profiles](AI-Profiles.md)
- [WASM Contract](WASM-Contract.md)
- [Development](Development.md)
- [Deployment](Deployment.md)
- [History](History.md)

See the [English project guide](../docs/README.en.md) and [中文项目说明](../docs/README.zh-CN.md)
for the complete repository documentation.
