# Roadmap

English | [中文](ROADMAP.zh-CN.md) · [Original repository](ORIGINAL_REPOSITORY.md)

## Now

- keep the offline WASM table stable;
- grow rule and browser regression coverage;
- add native/WASM snapshot parity fixtures;
- verify a real Vercel deployment before publishing a URL.

## Next

- audit the historical C++ repository when a checkout is available;
- make rule variants explicit instead of embedding them in `GameState`;
- add deterministic replay/export for bug reports;
- define a versioned command/snapshot schema shared by native, WASM, and server;
- add durable identity/reconnect and persistent room storage after the in-memory slice.

## Later

- add reconnect and spectator semantics;
- move online transport to WebSocket or long-polling when concurrent traffic warrants it.
