# .vendor/ — Vendored Source Subtrees for Agent Reference

This directory contains **read-only source subtrees** of key dependencies, synced to the exact versions installed in this project. These exist so that AI coding agents can directly read upstream source code without internet access.

## How to Use (for Agents)

When you need to understand how an Effect API works internally, **read the source directly**:

```
Read .vendor/effect/packages/effect/src/Schema.ts
Read .vendor/effect/packages/effect/src/Effect.ts
Read .vendor/effect/packages/effect/src/Data.ts
Read .vendor/effect/packages/effect/src/Match.ts
Read .vendor/effect/packages/experimental/src/VariantSchema.ts
```

### Package → Directory Map

| npm package            | Source directory                              |
| ---------------------- | -------------------------------------------- |
| `effect`               | `.vendor/effect/packages/effect/src/`        |
| `@effect/experimental` | `.vendor/effect/packages/experimental/src/`  |
| `@effect/platform`     | `.vendor/effect/packages/platform/src/`      |
| `@effect/platform-bun` | `.vendor/effect/packages/platform-bun/src/`  |
| `@effect/vitest`       | `.vendor/effect/packages/vitest/src/`        |
| `@effect/typeclass`    | `.vendor/effect/packages/typeclass/src/`     |
| `@effect/printer-ansi` | `.vendor/effect/packages/printer-ansi/src/`  |
| `@effect/ai`           | `.vendor/effect/packages/ai/ai/src/`         |
| `@effect/ai-openai`    | `.vendor/effect/packages/ai/openai/src/`     |
| `@effect/ai-anthropic` | `.vendor/effect/packages/ai/anthropic/src/`  |

### Internal vs Public

- `src/*.ts` — public API modules (what you import)
- `src/internal/` — private implementation details (not exported, but useful for understanding behavior)

## Rules

- **NEVER modify files in `.vendor/`** — they are synced from upstream
- **NEVER import from `.vendor/`** — use normal `import { ... } from "effect"` etc.
- These files exist solely for agent reference and source understanding
- Version is pinned in `.vendor/vendor.json` and must match installed packages

## Sync

```bash
bun run vendor:check   # see if versions drifted
bun run vendor:sync    # sync subtrees to installed versions
```
