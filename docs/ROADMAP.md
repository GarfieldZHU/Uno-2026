# Roadmap

[中文](ROADMAP.zh-CN.md) · [Original repository](ORIGINAL_REPOSITORY.md)

## Now

- keep the offline WASM table stable;
- grow rule and browser regression coverage;
- add native/WASM snapshot parity fixtures;
- verify a real Vercel deployment before publishing a URL.

## Next

- audit the historical C++ repository when a checkout is available;
- make rule variants explicit instead of embedding them in `GameState`;
- add deterministic replay/export for bug reports;
- define a versioned command/snapshot schema shared by native, WASM, and server.

## Later

- implement authenticated rooms and authoritative hidden hands;
- add reconnect and spectator semantics;
- enable the online switch only after end-to-end transport tests.
