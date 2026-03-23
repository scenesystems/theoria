---
description: Development guidelines for effect-dsp
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# effect-dsp

Effect-native implementation of the DSPy paradigm for TypeScript. Programming — not prompting — language models, with Effect.

## Commands

| Task       | Command         |
| ---------- | --------------- |
| Type check | `bun run check` |
| Lint       | `bun run lint`  |
| Test       | `bun run test`  |
| Build      | `bun run build` |

All four gates must pass clean before any work is considered complete.

## Architecture

Public modules: `Signature`, `Module`, `Optimizer`, `Metric`, `Evaluate`, `Example`, `Trace`, `Errors`, `Cache`.

Optimizer implementations live in `src/optimizers/` (self-contained per optimizer). Internal helpers in `src/internal/`. Test utilities in `src/testing/`.

## Conventions

- **Effect-native discipline** — no async/await, throw/try-catch, new Error(), console.\*, let, for/while, switch
- **Tests always use `@effect/vitest`** with `it.effect()`
- **Schema IS the signature** — Schema.Struct with description annotations defines I/O
- **Module IS an Effect** — factories return branded objects with `forward: Effect.fn(name)(...)`
- **Provider IS a Layer** — `LanguageModel` from `@effect/ai` is a Context.Tag

## Governance

- `internal/*` blocked from consumers via exports map
- `optimizers/*` blocked from consumers via exports map
- Only `src/internal/lm.ts` imports `@effect/ai` at runtime — sole import site
- 240 LOC file-size limit applies
- Each optimizer under `src/optimizers/` is self-contained
