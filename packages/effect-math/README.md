# @scenesystems/effect-math

Math provides numerical operations for [Effect](https://effect.website), including linear algebra, calculus, and probability. Call the synchronous functions with trusted values, or use their `Validated` variants to check unknown input and receive typed errors. Operations with a `WithPolicies` variant also let you configure numerical behavior through Effect services.

## Installation

```sh
bun add @scenesystems/effect-math effect
```

Requires Effect `^4.0.0` as a peer dependency. Import modules from the package root or matching subpaths, such as `@scenesystems/effect-math/LinearAlgebra`.

## Basic use

Compute a dot product directly or validate vectors supplied as unknown input.

```ts typecheck
import { Chunk, Effect } from "effect"
import { dot, dotValidated } from "@scenesystems/effect-math/LinearAlgebra"

const a = Chunk.make(1, 2, 3)
const b = Chunk.make(4, 5, 6)

export const direct: number = dot(a, b)

export const checked = dotValidated({
  a: [1, 2, 3],
  b: [4, 5, 6]
}).pipe(Effect.result)
```

## Domains

The module references describe each operation's inputs and numerical behavior.

| Concern                                   | Consumer role                                                                                                                                                                         |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`Numeric`](./src/Numeric.ts)             | Scalar transforms, stable log-space operations, safe division, reductions, selection, tolerances, iteration budgets, and `ExecutionError`                                             |
| [`Algebra`](./src/Algebra.ts)             | Polynomial evaluation and differentiation, greatest common divisors, least common multiples, and factorials                                                                           |
| [`Special`](./src/Special.ts)             | Gamma and beta functions, error functions, incomplete functions, digamma, and polygamma                                                                                               |
| [`LinearAlgebra`](./src/LinearAlgebra.ts) | Dense vectors and row-major matrices, including `Dimension`, `Axis`, norms, products, decomposition, and solving                                                                      |
| [`Geometry`](./src/Geometry.ts)           | Euclidean, Manhattan, and Chebyshev distances, midpoints, and centroids                                                                                                               |
| [`Statistics`](./src/Statistics.ts)       | Mean, variance, standard deviation, covariance, extrema, and summary statistics                                                                                                       |
| [`Complex`](./src/Complex.ts)             | Complex construction, arithmetic, transcendental functions, polar conversion, and vector operations                                                                                   |
| [`Calculus`](./src/Calculus.ts)           | Scalar and multivariate differentiation, complex-step differentiation, and numerical integration                                                                                      |
| [`Optimization`](./src/Optimization.ts)   | Bisection root finding and golden-section minimization                                                                                                                                |
| [`Probability`](./src/Probability.ts)     | Shannon entropy and its validated and policy-aware forms                                                                                                                              |
| [`Distribution`](./src/Distribution.ts)   | Normal and uniform density, cumulative, and transform operations plus normal, log-normal, exponential, uniform, beta, gamma, Student's t, categorical, binomial, and Poisson families |
| [`Policy`](./src/Policy.ts)               | Runtime randomness, precision, backend, and diagnostics services, settings snapshots, and complete policy Layers                                                                      |
| [`Scalar`](./src/Scalar.ts)               | Scalar-lane capabilities, policy, and resolution between Float64 and BigDecimal                                                                                                       |
| [`Backend`](./src/Backend.ts)             | Backend capabilities and backend resolution for a selected scalar lane                                                                                                                |
| [`Precision`](./src/Precision.ts)         | Convergence gates and scalar precision-escalation decisions                                                                                                                           |
| [`Autodiff`](./src/Autodiff.ts)           | Forward/reverse automatic-differentiation selection and finite-difference fallback                                                                                                    |
| [`Uncertainty`](./src/Uncertainty.ts)     | Float64 and BigDecimal uncertainty intervals and envelopes                                                                                                                            |
| [`Computation`](./src/Computation.ts)     | Effect services and Layers that plan scalar, backend, precision, differentiation, and uncertainty metadata                                                                            |

Vectors and matrices use immutable `Chunk<number>` values. A matrix is a row-major chunk accompanied by row and column counts, so `matvec(matrix, 2, 3, x)` multiplies a 2×3 matrix by a 3-vector. `LinearAlgebra.add(a, b)` adds vectors and `LinearAlgebra.scale(vector, alpha)` scales one. Distribution functions use suffixes such as `Pdf`, `Logpdf`, `Cdf`, `Quantile`, `Pmf`, and `Logpmf`.

Use `Distribution` for distribution functions and `Probability` for entropy:

```ts typecheck
import { Chunk } from "effect"
import { standardNormalCdf, standardNormalTransform } from "@scenesystems/effect-math/Distribution"
import { entropy } from "@scenesystems/effect-math/Probability"

export const median = standardNormalTransform(0.5)
export const confidence = standardNormalCdf(1.96)
export const fairCoinEntropy = entropy(Chunk.make(0.5, 0.5))
```

## Mathematical conventions

For vectors $a,b \in \mathbb{R}^n$ of the same length, `LinearAlgebra.dot(a, b)` computes the real inner product:

$$
\langle a,b\rangle = \sum_{i=1}^{n} a_i b_i
$$

`Distribution.normalPdf(x, mean, stdDev)` uses the standard deviation $\sigma > 0$, not the variance $\sigma^2$. Its density is:

$$
f(x;\mu,\sigma) = \frac{1}{\sigma\sqrt{2\pi}}\exp\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)
$$

For normalized probability masses $p_i \ge 0$ with $\sum_i p_i = 1$, `Probability.entropy` uses natural logarithms and returns nats:

$$
H(p) = -\sum_i p_i\ln p_i, \qquad 0\,\ln\,0 \coloneqq 0
$$

Thus a fair coin has entropy $\ln 2$, rather than one bit. These formulas describe the mathematical quantities; floating-point operations remain subject to the numerical behavior documented by each operation.

## Operation forms

An operation appears under its base name and, when its behavior needs them, with `Validated` and `WithPolicies` suffixes.

The base operation assumes its documented preconditions and returns a plain value. Where IEEE 754 defines a result, such as `-Infinity` for `log(0)`, scalar operations return that result. Use a validated operation when invalid input should enter the typed error channel; see [`Numeric`](./src/Numeric.ts) for numerical behavior and operation-specific alternatives.

Use the validated variant for deserialized data or other unknown input. It rejects excess properties and checks preconditions such as matching vector lengths before running the operation. Failures use module-local errors such as `DecodeError`, `ParameterError`, and `ShapeMismatchError`.

The policy-aware variant takes typed input and reads the runtime-policy services described below. It reports non-finite results as domain violations under a strict precision policy, consults backend preferences where documented, and emits diagnostics when they are enabled.

```ts typecheck
import { Chunk, Effect, Number } from "effect"
import { bisect, bisectValidated, bisectWithPolicies } from "@scenesystems/effect-math/Optimization"
import * as Policy from "@scenesystems/effect-math/Policy"
import { summaryStatistics, summaryStatisticsWithPolicies } from "@scenesystems/effect-math/Statistics"

const f = (x: number) => Number.subtract(Number.multiply(x, x), 2)

export const root: number = bisect(f, 0, 2)
export const rootFromInput = bisectValidated(f, { a: 0, b: 2 })

const policies = Policy.layerDeterministic({
  seed: Policy.Seed.make(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

export const program = Effect.gen(function* () {
  const strictRoot = yield* bisectWithPolicies(f, 0, 2)
  const samples = Chunk.make(2.5, 3.1, 2.9, 3.4, 2.8)
  const summary = yield* summaryStatisticsWithPolicies(samples)
  return { strictRoot, summary, direct: summaryStatistics(samples) }
}).pipe(Effect.provide(policies))
```

## Runtime policies

Provide the services from [`Policy`](./src/Policy.ts) to configure `WithPolicies` operations. Each service carries a `{ policy: ... }` value, and the operation's Effect type records which services it needs.

| Service              | Policy values                                    | Effect on policy-aware operations                                        |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `Policy.Randomness`  | deterministic with a `Seed`, or nondeterministic | Declares how operations that need randomness obtain it                   |
| `Policy.Precision`   | `strict` or `relaxed`                            | Strict turns rejected non-finite results into typed domain violations    |
| `Policy.Backend`     | `scalar` or `compensated`                        | Selects the documented backend preference for operations that consult it |
| `Policy.Diagnostics` | `enabled` or `disabled`                          | Enables or disables policy-aware diagnostic logging                      |

`Policy.layerDeterministic` and `Policy.layerNondeterministic` provide the full set. Use `Layer.succeed` when you need an individual service, and `Policy.snapshot` to read the current settings. Base and validated operations do not read these services.

For `Numeric.sumWithPolicies`, `compensated` selects Kahan-compensated accumulation over an immutable `Chunk`. The `scalar` policy selects ordinary iteration-order accumulation. This preference does not imply a different algorithm for every operation: `LinearAlgebra.dotWithPolicies`, for example, records the preference in diagnostics while using its documented dot-product algorithm.

## Computation planning

[`Computation`](./src/Computation.ts) plans a computation without executing it. The plan selects a scalar representation and compatible backend, then records precision, differentiation, and uncertainty decisions. `Computation.plan` decodes an untrusted request; `planWithAuthorities` accepts an already decoded request. Provide `Computation.layer` for the default planner and its services.

The planner's `Precision.Precision` service handles convergence and scalar escalation. It is separate from `Policy.Precision`, which sets strict or relaxed behavior for numerical `WithPolicies` operations.

## Errors

Validated and policy-aware operations fail with tagged errors, so `Effect.catchTag` and `Effect.catchTags` work on them directly. The API reference lists each operation's error union. Import errors from their module: `Numeric.ExecutionError` reports callback failure with the `KernelExecutionError` tag, and `LinearAlgebra.ShapeMismatchError` reports incompatible dimensions.

Base operations have no typed error channel. They require their documented preconditions; `Numeric.unsafeDivide`, for example, throws on a zero divisor, following Effect v4. Use `Numeric.safeDivide` for an `Option` result or `Numeric.unsafeDivideValidated` for typed validation failures.

## Examples

See the [API reference](./src/index.ts) for all modules and the [examples directory](./examples/) for runnable programs:

- [Numeric transforms](./examples/01-numeric-scalar-transforms.ts)
- [Linear algebra](./examples/02-linear-algebra-vectors.ts)
- [Geometry](./examples/03-geometry-distances.ts)
- [Probability](./examples/04-probability-distributions.ts)
- [Statistics](./examples/05-statistics-summary.ts)
- [Special functions](./examples/06-special-functions.ts)
- [Algebra](./examples/07-algebra-polynomials.ts)
- [Calculus](./examples/08-calculus-numerical.ts)
- [Optimization](./examples/09-optimization-solvers.ts)
- [Distributions](./examples/10-distributions.ts)

## Reference fixtures

Committed SciPy/NumPy fixtures provide independent numerical expectations. From this package directory, run `bun run fixtures:check` to validate them or `bun run fixtures:generate` to regenerate them. Generation requires [uv](https://docs.astral.sh/uv/); `bun run fixtures:lock` updates the Python dependency lock after dependency changes.

Set `SCIPY_FIXTURE_OUTPUT_DIRECTORY` to generate into a separate directory for review before replacing committed references. `SCIPY_FIXTURE_GENERATED_AT` overrides the default reproducible timestamp `2026-03-23T00:00:00Z`. Generator failures and invalid responses fail the command before any fixture files are written. Filesystem write failures can leave partial output, so use a separate output directory when reviewing regenerated references.

## Status

See Theoria's [versioning policy](../../README.md#documentation-and-examples) and the package [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

See Theoria's [contribution and support information](../../README.md#contributing-and-support).

## Attribution

Numerical behavior is checked against SciPy and NumPy reference values where those libraries provide corresponding operations. Implementations draw on established methods including the Lanczos gamma approximation, Cephes error-function coefficients, Kahan compensated summation, golden-section search, and complex-step differentiation. Licensing and source details for incorporated coefficient tables appear in [`THIRD_PARTY_NOTICES`](./THIRD_PARTY_NOTICES).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
