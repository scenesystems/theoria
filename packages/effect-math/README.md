# @scenesystems/effect-math

`@scenesystems/effect-math` is a numerical library for programs built with [Effect](https://effect.website). Its flat concern modules cover scalar numerics, algebra, linear algebra, calculus, special functions, probability and distributions, statistics, optimization, geometry, complex arithmetic, runtime policy, and computation planning. Operations use typed failures and schema-checked boundaries where values enter from outside.

Numerical concerns expose the forms their behavior needs. Base operations are synchronous functions for trusted values. `Validated` variants decode unknown input and return an `Effect` whose error channel names what went wrong. `WithPolicies` variants read only the runtime-policy services shown in their Effect requirement, so a program can provide numerical behavior with a Layer.

[`@scenesystems/effect-search`](../effect-search/README.md) builds its samplers on this package, and [`@scenesystems/effect-text`](../effect-text/README.md) uses it to score layout calibration. Content identities for cached numerical inputs come from [`@scenesystems/digest`](../digest/README.md).

## Installation

```sh
bun add @scenesystems/effect-math effect
```

Effect `^3.22.1` is a required peer dependency.

## Basic use

The example below uses a base operation for an internal calculation and a validated variant where the vectors arrive as untrusted input.

```ts typecheck
import { Chunk, Effect } from "effect"
import { dot, dotValidated } from "@scenesystems/effect-math/LinearAlgebra"

const a = Chunk.make(1, 2, 3)
const b = Chunk.make(4, 5, 6)

export const direct: number = dot(a, b)

export const checked = dotValidated({
  a,
  b
}).pipe(Effect.either)
```

Import from a concern subpath such as `@scenesystems/effect-math/LinearAlgebra` to keep imports focused, or import concern namespaces from the package root. There are no `contracts` or `experimental` compatibility subpaths.

## Domains

The public model is a set of owner-named concerns. Each link is both the source of the package subpath and an in-site API destination in generated documentation.

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

Vectors and matrices use immutable `Chunk<number>` carriers. A matrix is a row-major chunk accompanied by row and column counts, so `matvec(matrix, 2, 3, x)` multiplies a 2×3 matrix by a 3-vector. `LinearAlgebra.add(a, b)` adds vectors and `LinearAlgebra.scale(vector, alpha)` scales one. Distribution functions use suffixes such as `Pdf`, `Logpdf`, `Cdf`, `Quantile`, `Pmf`, and `Logpmf`.

Distribution evaluation and probability-mass operations have separate owners:

```ts typecheck
import { Chunk } from "effect"
import { standardNormalCdf, standardNormalTransform } from "@scenesystems/effect-math/Distribution"
import { entropy } from "@scenesystems/effect-math/Probability"

export const median = standardNormalTransform(0.5)
export const confidence = standardNormalCdf(1.96)
export const fairCoinEntropy = entropy(Chunk.make(0.5, 0.5))
```

## Naming and vocabulary

Effect imports retain their public module names: `Number.sum`, `Array.map`, `Boolean.match`, `String.concat`, `BigDecimal.multiply`, and `BigInt.gcd`. Concern imports retain their mathematical names. When operations overlap, qualify them with their owning namespace rather than inventing an alias:

```ts typecheck
import { Complex, Numeric } from "@scenesystems/effect-math"

export const realRoot = Numeric.sqrt(2)
export const complexRoot = Complex.sqrt(Complex.make(-1, 0))
```

Internal modules follow the same rule: `Arithmetic`, `Integration`, `Ridder`, and `Normal` name a subject or algorithm, without bridge or implementation suffixes. A pure implementation keeps its operation's spelling, including distribution suffixes such as `Logpdf` and `Logpmf`. Algorithm-specific names such as `gammaLanczos` identify an actual mathematical distinction. Conventional scalar symbols and coefficients remain mathematical notation, not abbreviations for module imports.

These conventions also apply to tests, examples, scripts, and documentation. The operation forms below describe behavior rather than import provenance.

## Operation forms

An operation appears under its base name and, when its behavior needs them, with `Validated` and `WithPolicies` suffixes.

The base operation assumes its documented preconditions and returns a plain value. Where IEEE 754 defines a result, such as `-Infinity` for `log(0)`, scalar operations return that result. `logStrict` preserves the established deterministic binary64 series, while `log` uses a range-reduced rational approximation through Effect's native `Number` module; both retain IEEE 754 exceptional-value behavior. Exponential range boundaries use `BigDecimal` to avoid premature overflow and underflow. Use `logValidated` when invalid logarithm input should enter the typed error channel.

The validated variant takes `unknown`, decodes it against the operation's input schema with excess properties rejected, checks structural preconditions such as matching lengths, and runs the operation. Errors have concise module-local names such as `DecodeError`, `ParameterError`, and `ShapeMismatchError`; their established wire tags remain stable. Use validated operations at API boundaries, on deserialized data, and anywhere bad input should remain in the typed error channel.

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

Policy-aware operations declare their configuration as `Context.Tag` services from [`Policy`](./src/Policy.ts), and an Effect that calls one keeps those services in its requirements until a Layer provides them. Service payloads retain the `{ policy: ... }` shape.

| Service              | Policy values                                    | Effect on policy-aware operations                                        |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| `Policy.Randomness`  | deterministic with a `Seed`, or nondeterministic | Declares how operations that need randomness obtain it                   |
| `Policy.Precision`   | `strict` or `relaxed`                            | Strict turns rejected non-finite results into typed domain violations    |
| `Policy.Backend`     | `scalar` or `compensated`                        | Selects the documented backend preference for operations that consult it |
| `Policy.Diagnostics` | `enabled` or `disabled`                          | Enables or disables policy-aware diagnostic logging                      |

`Policy.layerDeterministic` and `Policy.layerNondeterministic` build a Layer with all four services. `Policy.snapshot` reads them into `Policy.Settings`. Supply a single service with `Layer.succeed` when an operation needs only part of the set. Policies affect only operations with the `WithPolicies` suffix; base and validated operations never read them, so a policy Layer cannot change code that did not opt in.

For `Numeric.sumWithPolicies`, `compensated` selects Kahan-compensated accumulation over an immutable `Chunk`. The `scalar` policy selects ordinary iteration-order accumulation. This preference does not imply a different algorithm for every operation: `LinearAlgebra.dotWithPolicies`, for example, records the preference in diagnostics while using its documented dot-product algorithm.

## Computation planning

The planning concerns describe how a numerical computation should run without executing its kernel. [`Scalar`](./src/Scalar.ts) selects an available Float64 or BigDecimal lane. [`Precision`](./src/Precision.ts) evaluates convergence and escalation. [`Backend`](./src/Backend.ts) resolves a backend compatible with the selected lane. [`Autodiff`](./src/Autodiff.ts) chooses forward or reverse mode, or an allowed finite-difference fallback. [`Uncertainty`](./src/Uncertainty.ts) defines lane-specific result envelopes.

[`Computation`](./src/Computation.ts) composes those decisions. `Computation.plan` decodes untrusted requests through the configured `Computation` service; `Computation.planWithAuthorities` accepts a decoded request and reads the individual authority services. `Computation.layer` provides the default planner and authorities. This planning layer records selections and provenance; it does not execute a numerical operation.

`Policy.Precision` is the strict/relaxed runtime policy read by numerical `WithPolicies` operations. `Precision.Precision` is a separate computation-planning service for convergence and scalar escalation. Their qualified names make that distinction explicit.

## Errors and boundaries

Validated and policy-aware operations fail with tagged errors, so `Effect.catchTag` and `Effect.catchTags` work on them directly and the generated API reference lists each operation's exact union. Import errors from their owning concern: for example, `Numeric.ExecutionError` captures callback failure while preserving the `KernelExecutionError` wire tag, and `LinearAlgebra.ShapeMismatchError` reports incompatible dimensions. Encodable errors use `Schema.TaggedError`; service-only failures that need no codec may use `Data.TaggedError`.

Base operations have no error channel. They do what their documentation says for valid input and follow IEEE 754 otherwise; validation is the caller's job or the validated variant's.

## Examples

The [examples directory](./examples/) contains runnable programs showing base, validated, and policy-aware forms: [numeric transforms](./examples/01-numeric-scalar-transforms.ts), [linear algebra](./examples/02-linear-algebra-vectors.ts), [geometry](./examples/03-geometry-distances.ts), [probability](./examples/04-probability-distributions.ts), [statistics](./examples/05-statistics-summary.ts), [special functions](./examples/06-special-functions.ts), [algebra](./examples/07-algebra-polynomials.ts), [calculus](./examples/08-calculus-numerical.ts), [optimization](./examples/09-optimization-solvers.ts), and [distributions](./examples/10-distributions.ts).

## Reference fixtures

Committed SciPy/NumPy fixtures provide independent numerical expectations. From this package directory, run `bun run fixtures:check` to validate them or `bun run fixtures:generate` to regenerate them. Generation requires [uv](https://docs.astral.sh/uv/); `bun run fixtures:lock` updates the Python dependency lock after dependency changes.

The Effect entrypoint discovers reference families, runs Python processes in scopes with bounded concurrency, decodes their JSON responses through the fixture schemas, and writes the fixture files and manifest. Python owns SciPy/NumPy reference computation, result conversion, and JSON input/output. The manifest records the actual SciPy, NumPy, and Python versions used.

Set `SCIPY_FIXTURE_OUTPUT_DIRECTORY` to generate into a separate directory for review before replacing committed references. `SCIPY_FIXTURE_GENERATED_AT` overrides the default reproducible timestamp `2026-03-23T00:00:00Z`. Generator failures and invalid responses fail the command before any fixture files are written. Filesystem write failures can leave partial output, so use a separate output directory when reviewing regenerated references.

## Status

This package is pre-1.0. Public concern APIs are provisional: minor releases may change signatures and behavior. Pin a compatible version and review the [changelog](./CHANGELOG.md) when upgrading.

## Contributing and support

Read the repository [contributing guide](../../CONTRIBUTING.md) before opening a pull request. Report defects and request changes through [GitHub issues](https://github.com/scenesystems/theoria/issues). For security concerns, follow the [security policy](../../SECURITY.md).

## Attribution

Numerical behavior is checked against SciPy and NumPy reference values where those libraries provide corresponding operations. Implementations draw on established methods including the Lanczos gamma approximation, Cephes error-function coefficients, Kahan compensated summation, golden-section search, and complex-step differentiation. Licensing and source details for incorporated coefficient tables appear in [`THIRD_PARTY_NOTICES`](./THIRD_PARTY_NOTICES).

## License

[MIT](./LICENSE). Copyright 2026 Scene Systems.
