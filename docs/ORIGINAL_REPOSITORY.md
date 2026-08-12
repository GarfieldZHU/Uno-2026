# Original repository and memorial

[中文](ORIGINAL_REPOSITORY.zh-CN.md) · [Project index](README.en.md)

## Historical link

- Main repository: <https://github.com/1411-duliu/Uno>
- Historical hard-AI branch: <https://github.com/1411-duliu/Uno/tree/ai_hard/Uno>

The old project is a C++ UNO game. UNO 2026 is a respectful continuation in a new
runtime: Rust for deterministic rules, WebAssembly for offline browser execution,
and React/TypeScript for a readable table. The names `garfield1993-ai-simple` and
`garfield1993-ai-hard` are deliberately kept as a bridge between the two projects.

## What was and was not verified

The initial implementation environment could not resolve GitHub DNS, so the old
repository could not be cloned or inspected during the build. We therefore do not
claim source-level parity, recovered directory structure, or recovered private AI
heuristics. The current implementation is based on the standard UNO rules described
in this repository and leaves the provenance boundary explicit.

If the old source becomes available, the next responsible step is a read-only audit:
map its deck/turn model and AI decisions, add parity fixtures for observable cases,
and document every intentional divergence. Do not copy old code or assets without
checking its license and author permissions.

## Why preserve the link?

Small old games are part of a developer's history. Linking the original keeps its
authors visible, gives future maintainers a place to compare ideas, and makes this
rewrite an act of remembrance rather than an attempt to erase its origin. The new
project can modernize the medium without pretending the first version never existed.
