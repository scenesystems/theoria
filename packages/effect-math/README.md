# @scenesystems/effect-math

`@scenesystems/effect-math` provides mathematical operations designed to compose with [Effect](https://effect.website) programs. It covers scalar numerics, structured mathematical domains, schema-checked boundaries, typed failures, and runtime-controlled numerical behavior.

The public operations have three forms. Pure kernels are synchronous functions for trusted values and hot numerical paths. Validated variants return `Effect` values with schema decoding and domain-specific errors. Policy-aware variants also read services from the Effect context, allowing precision, backend, diagnostics, and random-number policies to be supplied with Layers. Domain subpaths keep imports focused while the package root exposes the same domains as namespaces and re-exports shared contracts.

## Installation

Install the package with its required peer dependency:

```sh
npm install @scenesystems/effect-math effect
```

The package is compatible with Effect `^3.22.1`.

## Minimal example

This example uses a pure kernel for an internal calculation and a validated Effect variant at an input boundary.

```ts typecheck
import { Chunk, Effect } from "effect"
import { dot, dotValidated } from "@scenesystems/effect-math/LinearAlgebra"

const a = Chunk.fromIterable([1, 2, 3])
const b = Chunk.fromIterable([4, 5, 6])

const direct: number = dot(a, b)
const checked = dotValidated({
  a: [1, 2, 3],
  b: [4, 5, 6]
})

export { checked, direct }
```

Pure kernels assume their documented preconditions. Validated variants decode unknown input and represent validation or mathematical failures in the error channel. Policy-aware variants add service requirements to the Effect environment.

## Domain navigation

Each shipped domain is available at `@scenesystems/effect-math/<Domain>`.

| Domain          | Scope                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Numeric`       | Scalar transforms, stable logarithmic and exponential operations, safe division, selection, and summation                      |
| `Algebra`       | Polynomial evaluation and differentiation, greatest common divisors, least common multiples, and factorials                    |
| `LinearAlgebra` | Dense vectors and row-major matrices over immutable `Chunk` carriers, including norms, products, decomposition, and solving    |
| `Calculus`      | Scalar and multivariate numerical differentiation, error-estimating derivative limits, and numerical integration               |
| `Special`       | Gamma and beta functions, error functions, incomplete functions, digamma, and polygamma                                        |
| `Probability`   | Normal and uniform density and cumulative functions, plus Shannon entropy                                                      |
| `Statistics`    | Descriptive statistics, variance, covariance, extrema, and summary statistics                                                  |
| `Optimization`  | Bisection root finding and golden-section minimization                                                                         |
| `Geometry`      | Euclidean, Manhattan, and Chebyshev distances, midpoints, and centroids                                                        |
| `Complex`       | Complex arithmetic, transcendental functions, polar conversion, vector operations, and complex-step differentiation            |
| `Distribution`  | Normal, log-normal, exponential, uniform, beta, gamma, Student's t, categorical, binomial, and Poisson distribution operations |

Shared schemas, policy services, Layers, branded scalars, and cross-domain errors are exported from [`@scenesystems/effect-math/contracts`](./src/contracts/index.ts). The [`experimental`](./src/experimental/index.ts) subpath contains explicitly experimental seams. Experimental APIs can change or be removed independently of the provisional domain APIs.

## Runtime policies

Policy-aware operations describe their configuration needs through `Context.Tag` services. An Effect that uses one of these operations retains the required service types in its environment. A `Layer` constructs and supplies service implementations; providing the Layer removes those requirements from the resulting Effect.

| Service                    | Configuration                                    | Behavior                                                                                                                |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `PrecisionPolicyService`   | `strict` or `relaxed`                            | Strict mode turns non-finite policy-checked results into typed domain violations; relaxed mode permits IEEE-754 results |
| `BackendPolicyService`     | `scalar` or `typed-array`                        | Selects the supported execution strategy for operations that consult a backend                                          |
| `DiagnosticsPolicyService` | `enabled` or `disabled`                          | Controls diagnostic logging from policy-aware operations                                                                |
| `RngPolicyService`         | deterministic with a `Seed`, or nondeterministic | Describes reproducibility for operations that require randomness                                                        |

`makeDeterministicRuntimePoliciesLayer` and `makeNondeterministicRuntimePoliciesLayer` create Layers containing all four services. Individual services can also be supplied with `Layer.succeed` when an operation requires only part of the policy set. A policy changes only operations documented as policy-aware; pure and validated operations do not read these services.

## Typed errors

Validated and policy-aware operations expose errors in the Effect error channel. Errors are `Schema.TaggedError` values with a stable `_tag`, so callers can use `Effect.catchTag`, `Effect.catchTags`, or ordinary Effect error combinators. Boundary decode and encode failures carry contract context. Domain errors distinguish invalid parameters, incompatible shapes, convergence failures, singular systems, and non-finite results where applicable.

Representative tags include `ShapeMismatchError`, `SingularMatrixError`, `OptimizationConvergenceError`, `StatisticsShapeError`, `ComplexDivisionByZeroError`, and each domain's `*DomainViolationError`. The generated reference gives the exact error union for each operation.

## Examples and reference

Runnable examples are organized by domain in the [`examples`](./examples/) directory. They show pure, validated, and policy-aware calls for numerics, linear algebra, geometry, probability, statistics, special functions, algebra, calculus, optimization, and distributions. Each public domain subpath is the preferred location for focused imports.

## Status

This package is pre-1.0. All eleven domain APIs are currently marked `provisional`, so signatures and behavior may change between versions. The `experimental` subpath has a lower stability expectation and is clearly separated from the domain surfaces. Review the [changelog](./CHANGELOG.md) when upgrading.

## Contribution and support

Contributions are welcome through the repository's [contribution guide](../../CONTRIBUTING.md). Use [GitHub issues](https://github.com/scenesystems/theoria/issues) for reproducible bug reports, API questions, and focused feature proposals. Security concerns should follow the repository's [security policy](../../SECURITY.md).

## Attribution

Numerical behavior is compared with committed SciPy and NumPy reference fixtures where those libraries provide corresponding operations. Calculus operators without one-to-one SciPy APIs use analytic reference formulations. Implementations also draw on established methods including Lanczos gamma approximation, Cephes error-function coefficients, Kahan compensated summation, golden-section search, and complex-step differentiation. Licensing and source details for incorporated coefficient tables appear in [`THIRD_PARTY_NOTICES`](./THIRD_PARTY_NOTICES).

## License

[MIT](./LICENSE), copyright 2026 Scene Systems.
