# effect-math

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Foundational mathematics for the [Effect](https://effect.website) ecosystem — numerics, linear algebra, statistics, and optimization with typed errors, schema-validated inputs, and configurable runtime policies.

## Install

```sh
npm install effect-math
# or
bun add effect-math
```

Peer dependency: `effect >= 3.20.0`

## Quick Start

```ts
import { Chunk, Effect } from "effect"
import { dot, normL2, vectorAdd, vectorScale } from "effect-math/LinearAlgebra"

const a = Chunk.fromIterable([1, 2, 3])
const b = Chunk.fromIterable([4, 5, 6])

// Pure kernel — no Effect wrapper needed
const dotProduct = dot(a, b) // 32
const magnitude = normL2(a) // √14
const sum = vectorAdd(a, b) // Chunk(5, 7, 9)
const scaled = vectorScale(2, a) // Chunk(2, 4, 6)
```

```ts
import { Effect } from "effect"
import { normEffect } from "effect-math/LinearAlgebra"

// Effect-wrapped with schema validation and typed errors
const program = Effect.gen(function* () {
  const result = yield* normEffect({ values: [3, 4], kind: "L2" })
  console.log(result) // 5
})

Effect.runSync(program)
```

## Domains

Each domain is a self-contained subpath export with its own schemas, errors, and operations.

| Domain            | Import                      | Description                                                                                                                      |
| ----------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Numeric**       | `effect-math/Numeric`       | Scalar transforms — `safeDivide`, `log1p`, `expm1`, `sum`, `argmax`, `clamp`, `between`                                          |
| **LinearAlgebra** | `effect-math/LinearAlgebra` | Dense vector/matrix operations — `dot`, `normL1`/`L2`/`Linf`, `vectorAdd`, `vectorScale`, `matvec`, `transpose`, `frobeniusNorm` |
| **Algebra**       | `effect-math/Algebra`       | Abstract algebraic structures                                                                                                    |
| **Calculus**      | `effect-math/Calculus`      | Differentiation and integration                                                                                                  |
| **Special**       | `effect-math/Special`       | Special mathematical functions                                                                                                   |
| **Probability**   | `effect-math/Probability`   | Probability distributions and sampling                                                                                           |
| **Statistics**    | `effect-math/Statistics`    | Descriptive and inferential statistics                                                                                           |
| **Optimization**  | `effect-math/Optimization`  | Numerical optimization and solvers                                                                                               |
| **Geometry**      | `effect-math/Geometry`      | Geometric primitives and transforms                                                                                              |

> Numeric and LinearAlgebra are implemented. Other domains are planned.

## Architecture

Every domain follows the same file structure:

```
src/Numeric/
├── contract.ts     # Domain identity and metadata
├── model.ts        # Domain model instance
├── schema.ts       # Schema definitions and branded types
├── errors.ts       # Typed error taxonomy
├── operations.ts   # Public operations (pure + effectful)
├── internal/       # Implementation kernels (not exported)
└── index.ts        # Public surface re-exports
```

Internal modules are blocked from import via the package `exports` map — consumers only access the public surface through domain subpaths.

## Effect-Native Design

Every API is built on Effect primitives:

- **`Chunk<number>`** as the vector/matrix carrier — immutable, structurally shareable, persistent
- **`Number` module** for arithmetic (`Number.divide`, `Number.sumAll`, `Number.clamp`, `Number.between`)
- **`Schema.TaggedClass`** for data types like `DenseVector` and `DenseMatrix`
- **`Schema.TaggedError`** for all failure types — every error carries a `_tag` for pattern matching
- **`Match.exhaustive`** for dispatch — norm kind selection, policy branching, backend strategy
- **`Context.Tag`** services for runtime policies — injected via `Layer` composition

Operations come in three tiers:

1. **Pure kernel** — synchronous functions on `Chunk<number>`, no Effect wrapper (`dot`, `normL2`, `vectorAdd`)
2. **Effect-wrapped** — schema-validated input with typed errors (`dotEffect`, `normEffect`, `matvecEffect`)
3. **Policy-aware** — additionally require runtime policy services (`dotWithPolicies`, `sumWithPolicies`)

## Typed Errors

Each domain defines a typed error taxonomy using `Schema.TaggedError`. Errors are discriminated by `_tag` and carry structured context:

```ts
import { Effect } from "effect"
import { matvecEffect } from "effect-math/LinearAlgebra"
import type { ShapeMismatchError, LinearAlgebraDecodeError } from "effect-math/LinearAlgebra"

const program = matvecEffect({
  rows: 2,
  cols: 3,
  data: [1, 2, 3, 4, 5, 6],
  x: [1, 2] // wrong length — cols is 3
})

// Error channel is ShapeMismatchError | LinearAlgebraDecodeError
const handled = program.pipe(
  Effect.catchTag("ShapeMismatchError", (e) => Effect.succeed(`Shape error: expected ${e.expected}, got ${e.actual}`))
)
```

LinearAlgebra error types:

| Error                               | When                                       |
| ----------------------------------- | ------------------------------------------ |
| `LinearAlgebraDecodeError`          | Schema validation fails on input           |
| `ShapeMismatchError`                | Dimension incompatibility between operands |
| `SingularMatrixError`               | Operation requires a non-singular matrix   |
| `DecompositionError`                | Matrix factorization cannot be completed   |
| `LinearAlgebraDomainViolationError` | Non-finite or otherwise invalid result     |

## Runtime Policies

Policy-aware operations read configuration from Effect services via `Context.Tag`. Compose the policies you need using `Layer`:

```ts
import { Effect, Layer } from "effect"
import { PrecisionPolicyService, BackendPolicyService, DiagnosticsPolicyService } from "effect-math/contracts"
import { dotWithPolicies } from "effect-math/LinearAlgebra"
import { Chunk } from "effect"

const policies = Layer.mergeAll(
  Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
  Layer.succeed(BackendPolicyService, { policy: "typed-array" }),
  Layer.succeed(DiagnosticsPolicyService, { policy: "enabled" })
)

const program = Effect.gen(function* () {
  const a = Chunk.fromIterable([1, 2, 3])
  const b = Chunk.fromIterable([4, 5, 6])
  return yield* dotWithPolicies(a, b)
})

Effect.runSync(program.pipe(Effect.provide(policies)))
```

| Policy                     | Values                       | Effect                                                     |
| -------------------------- | ---------------------------- | ---------------------------------------------------------- |
| `PrecisionPolicyService`   | `"strict"` / `"relaxed"`     | Strict rejects non-finite results; relaxed permits them    |
| `BackendPolicyService`     | `"typed-array"` / `"scalar"` | Selects between `Float64Array` and plain scalar execution  |
| `DiagnosticsPolicyService` | `"enabled"` / `"disabled"`   | Emits `Effect.logDebug` with operation timing and metadata |

A convenience constructor `makeDeterministicRuntimePoliciesLayer` builds all four policy layers (including RNG) from a single config object — useful for reproducible test fixtures.

## Status

| Tier             | Domains                                                                     | Meaning                                              |
| ---------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Stable**       | Numeric                                                                     | API surface is fixed; breaking changes follow semver |
| **Provisional**  | LinearAlgebra                                                               | API is functional but may evolve                     |
| **Experimental** | Algebra, Calculus, Special, Probability, Statistics, Optimization, Geometry | Scaffolded; not yet implemented                      |

Experimental surfaces are available under `effect-math/experimental` and are excluded from stability guarantees.

## Contributing

See the [repository](https://github.com/scenesystems/theoria) for contribution guidelines.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
