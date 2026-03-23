---
description: Development guidelines for effect-math
globs: "**/*.ts, **/*.mts"
alwaysApply: true
---

# effect-math

Foundational mathematics and statistics package for the Effect ecosystem.

## Commands

| Task       | Command         |
| ---------- | --------------- |
| Type check | `bun run check` |
| Lint       | `bun run lint`  |
| Test       | `bun run test`  |
| Build      | `bun run build` |

All four gates must pass clean before any work is considered complete.

## Architecture

`effect-math` is domain-first:

1. `Numeric`
2. `Algebra`
3. `LinearAlgebra`
4. `Calculus`
5. `Special`
6. `Probability`
7. `Statistics`
8. `Optimization`
9. `Geometry`

Each domain owns:

1. `contract.ts`
2. `model.ts`
3. `schema.ts`
4. `errors.ts`
5. `operations.ts`
6. `internal/`
7. `index.ts`

Cross-domain ownerless primitives live in `src/contracts/shared/*`.

## Governance

- Public exports are subpath-domain barrels only.
- `internal/*` is blocked in package exports.
- Every domain public model must preserve model-contract parity.
- Cross-domain imports from another domain's `internal/*` are forbidden.
