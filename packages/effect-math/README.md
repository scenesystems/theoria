# @scenesystems/effect-math

`@scenesystems/effect-math` is a numerical library for programs built with [Effect](https://effect.website). It covers scalar numerics, linear algebra, calculus, special functions, probability distributions, statistics, root finding and minimization, geometry, and complex arithmetic, with typed failures and schema-checked boundaries where numbers enter from outside.

Every domain offers its operations in up to three forms. Pure kernels are plain synchronous functions for trusted values on hot paths. Validated variants decode unknown input against a schema and return an Effect whose error channel names what went wrong. Policy-aware variants additionally read precision, backend, diagnostics, and randomness policies from the Effect context, so a whole program's numerical behavior can be set with one Layer.

[`@scenesystems/effect-search`](../effect-search/README.md) builds its samplers on this package, and [`@scenesystems/effect-text`](../effect-text/README.md) uses it to score layout calibration. Content identities for cached numerical inputs come from [`@scenesystems/digest`](../digest/README.md).

## Installation

```sh
npm install @scenesystems/effect-math effect
```

Effect `^3.22.1` is a required peer dependency.

## Basic use

The example below uses a pure kernel for an internal calculation and a validated variant where the vectors arrive as untrusted input.

```ts typecheck
import { Chunk, Effect } from "effect"
import { dot, dotValidated } from "@scenesystems/effect-math/LinearAlgebra"

const a = Chunk.fromIterable([1, 2, 3])
const b = Chunk.fromIterable([4, 5, 6])

export const direct: number = dot(a, b)

export const checked = dotValidated({ a: [1, 2, 3], b: [4, 5, 6] }).pipe(
  Effect.catchTags({
    LinearAlgebraDecodeError: () => Effect.succeed(Number.NaN),
    ShapeMismatchError: () => Effect.succeed(Number.NaN)
  })
)
```

Import from a domain subpath such as `@scenesystems/effect-math/LinearAlgebra` to keep imports focused, or from the package root, which exposes every domain as a namespace and re-exports the shared contracts.

## Domains

| Domain          | Scope                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Numeric`       | Scalar transforms, stable logarithmic and exponential operations, safe division, selection, clamping, and compensated summation  |
| `Algebra`       | Polynomial evaluation and differentiation, greatest common divisors, least common multiples, and factorials                      |
| `LinearAlgebra` | Dense vectors and row-major matrices over immutable `Chunk` carriers: norms, products, transposition, decomposition, and solving |
| `Calculus`      | Scalar and multivariate numerical differentiation, error-estimating derivative limits, and numerical integration                 |
| `Special`       | Gamma and beta functions, error functions, incomplete functions, digamma, and polygamma                                          |
| `Probability`   | Normal and uniform density and cumulative functions, and Shannon entropy                                                         |
| `Distribution`  | Normal, log-normal, exponential, uniform, beta, gamma, Student's t, categorical, binomial, and Poisson distributions             |
| `Statistics`    | Mean, variance, standard deviation, covariance, extrema, and summary statistics                                                  |
| `Optimization`  | Bisection root finding and golden-section minimization                                                                           |
| `Geometry`      | Euclidean, Manhattan, and Chebyshev distances, midpoints, and centroids                                                          |
| `Complex`       | Complex arithmetic, transcendental functions, polar conversion, vector operations, and complex-step differentiation              |

Vectors and matrices are `Chunk<number>` values. A matrix is a row-major chunk accompanied by its row and column counts, so `matvec(matrix, 2, 3, x)` multiplies a 2×3 matrix by a 3-vector. Distribution functions follow a uniform naming scheme: `<name>Pdf`, `<name>Logpdf`, `<name>Cdf`, `<name>Quantile`, `<name>Mean`, `<name>Variance`, and `<name>Entropy` for continuous distributions, with `Pmf` and `Logpmf` for discrete ones.

Shared schemas, policy services, Layers, branded scalars, and cross-domain errors are exported from [`@scenesystems/effect-math/contracts`](./src/contracts/index.ts).

## Operation forms

Each operation appears under its base name and, where the domain provides them, with `Validated` and `WithPolicies` suffixes.

The pure kernel assumes its documented preconditions and returns a plain value. It never throws for numerical reasons; where IEEE 754 defines a result, such as `-Infinity` for `log(0)`, it returns that result. Some kernels have a `Strict` sibling, such as `logStrict`, that rejects inputs outside the real domain instead.

The validated variant takes `unknown`, decodes it against the operation's input schema with excess properties rejected, checks structural preconditions such as matching lengths, and runs the kernel. Its errors are a `<Domain>DecodeError` for schema failures plus domain errors such as `ShapeMismatchError`. Use it at API boundaries, on deserialized data, and anywhere a bad input should be a value rather than a crash.

The policy-aware variant takes typed input and reads the runtime-policy services described below. It reports non-finite results as domain violations under a strict precision policy, dispatches to a typed-array backend when one is selected, and emits diagnostics when they are enabled.

```ts typecheck
import { Chunk, Effect } from "effect"
import { makeDeterministicRuntimePoliciesLayer, Seed } from "@scenesystems/effect-math/contracts"
import { bisect, bisectValidated, bisectWithPolicies } from "@scenesystems/effect-math/Optimization"
import { summaryStatistics, summaryStatisticsWithPolicies } from "@scenesystems/effect-math/Statistics"

const f = (x: number) => x * x - 2

export const root: number = bisect(f, 0, 2)
export const rootFromInput = bisectValidated(f, { a: 0, b: 2 })

const policies = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
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

Policy-aware operations declare their configuration as `Context.Tag` services from `contracts`, and an Effect that calls one keeps those services in its requirements until a Layer provides them.

| Service                    | Values                                           | Effect on policy-aware operations                                                  |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `PrecisionPolicyService`   | `strict` or `relaxed`                            | Strict turns non-finite results into typed domain violations; relaxed returns them |
| `BackendPolicyService`     | `scalar` or `typed-array`                        | Selects the execution strategy for operations that consult a backend               |
| `DiagnosticsPolicyService` | `enabled` or `disabled`                          | Turns timing and diagnostic logging on or off                                      |
| `RngPolicyService`         | deterministic with a `Seed`, or nondeterministic | Declares how operations that need randomness obtain it                             |

`makeDeterministicRuntimePoliciesLayer` and `makeNondeterministicRuntimePoliciesLayer` build a Layer with all four services. Supply a single service with `Layer.succeed` when an operation needs only part of the set. Policies affect only operations with the `WithPolicies` suffix; pure and validated operations never read them, so a policy Layer cannot change the meaning of code that did not opt in.

## Public surface

Every domain is available as a namespace from the package root and as a subpath such as `@scenesystems/effect-math/LinearAlgebra`.

| Module                                          | Scope                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [`Numeric`](./src/Numeric/index.ts)             | Scalar kernels, stable log-space arithmetic, reductions, and their validated and policy forms |
| [`Algebra`](./src/Algebra/index.ts)             | Polynomials and integer arithmetic                                                            |
| [`LinearAlgebra`](./src/LinearAlgebra/index.ts) | Vectors, matrices, norms, decompositions, and solvers                                         |
| [`Calculus`](./src/Calculus/index.ts)           | Differentiation and integration                                                               |
| [`Special`](./src/Special/index.ts)             | Special functions                                                                             |
| [`Probability`](./src/Probability/index.ts)     | Normal and uniform functions and entropy                                                      |
| [`Distribution`](./src/Distribution/index.ts)   | Distribution families                                                                         |
| [`Statistics`](./src/Statistics/index.ts)       | Descriptive statistics                                                                        |
| [`Optimization`](./src/Optimization/index.ts)   | Root finding and minimization                                                                 |
| [`Geometry`](./src/Geometry/index.ts)           | Distances and point aggregates                                                                |
| [`Complex`](./src/Complex/index.ts)             | Complex numbers                                                                               |
| [`Contracts`](./src/contracts/index.ts)         | Shared schemas, branded scalars, policy services, Layers, and cross-domain errors             |
| [`Experimental`](./src/experimental/index.ts)   | Unstable APIs that may change outside semver guarantees                                       |

Paths under `internal` are not exported.

## Errors and boundaries

Validated and policy-aware operations fail with `Schema.TaggedError` values, so `Effect.catchTag` and `Effect.catchTags` work on them directly and the generated API reference lists the exact union for each operation. Each domain has a `<Domain>DecodeError` for schema failures, a `<Domain>ParameterError` for parameters outside the operation's domain, and a `<Domain>DomainViolationError` for results a strict policy rejects. Structural errors are more specific: `ShapeMismatchError` for vectors and matrices whose dimensions disagree, and `StatisticsShapeError` for too few samples.

Pure kernels have no error channel. They do what their documentation says for valid input and follow IEEE 754 otherwise; validation is the caller's job or the validated variant's.

## Examples

The [examples directory](./examples/) contains one runnable program per domain, each showing the pure, validated, and policy-aware forms side by side: [numeric transforms](./examples/01-numeric-scalar-transforms.ts), [linear algebra](./examples/02-linear-algebra-vectors.ts), [geometry](./examples/03-geometry-distances.ts), [probability](./examples/04-probability-distributions.ts), [statistics](./examples/05-statistics-summary.ts), [special functions](./examples/06-special-functions.ts), [algebra](./examples/07-algebra-polynomials.ts), [calculus](./examples/08-calculus-numerical.ts), [optimization](./examples/09-optimization-solvers.ts), and [distributions](./examples/10-distributions.ts).

## Status

This package is pre-1.0. All domain APIs are provisional: minor releases may change signatures and behavior. Pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading. The `Experimental` module may change or be removed with less migration support than the domain modules.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

Numerical behavior is checked against SciPy and NumPy reference values where those libraries provide corresponding operations. Implementations draw on established methods including the Lanczos gamma approximation, Cephes error-function coefficients, Kahan compensated summation, golden-section search, and complex-step differentiation. Licensing and source details for incorporated coefficient tables appear in [`THIRD_PARTY_NOTICES`](./THIRD_PARTY_NOTICES).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
