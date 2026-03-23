---
description: Development guidelines for effect-search
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# effect-search

Effect-native black-box optimization for TypeScript.

## Commands

| Task       | Command         |
| ---------- | --------------- |
| Type check | `bun run check` |
| Lint       | `bun run lint`  |
| Test       | `bun run test`  |
| Build      | `bun run build` |

All four gates must pass clean before any work is considered complete.

## Architecture

Public modules: `Cache`, `Contracts`, `Errors`, `Experimental`, `Pareto`, `Sampler`, `Scheduler`, `SearchSpace`, `Study`, `StudyEvent`, `Trial`.

Each module owns an `index.ts` barrel. Implementation details live in `src/internal/` and `src/samplers/`.

## Conventions

- **Effect-native discipline** — no async/await, throw/try-catch, new Error(), console.\*, let, for/while, switch
- **Tests always use `@effect/vitest`** with `it.effect()`
- **Schema is the single source of truth** — types derived from Schema, never hand-written interfaces
- **Deterministic** — same seed, same results. All samplers accept a seed parameter

## Governance

- `internal/*` blocked from consumers via exports map
- No native math library types leak through public surface
- 240 LOC file-size limit applies
- Only implementation modules under `src/internal/**`, `src/samplers/**`, `src/Sampler/**`, `src/Study/**`, and `src/experimental/**` may import `internal/*` paths
