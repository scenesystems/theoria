# `effect-math`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Mathematics for the [Effect](https://effect.website) ecosystem. Numerics, linear algebra, geometry, probability, statistics, distributions, FFTs, and special functions — with typed errors, immutable carriers, and configurable runtime policies.

[Quick start](#quick-start) · [Domains](#domains) · [Runtime policies](#runtime-policies) · [Error handling](#error-handling) · [API at a glance](#api-at-a-glance)

---

## Why effect-math?

Most math libraries give you raw functions that throw on bad input, mutate buffers in place, and offer no way to control precision behavior or trace what happened. `effect-math` is different:

- **Immutable `Chunk<number>` carriers** — no hidden mutation, structurally shareable, persistent
- **Typed errors** — every failure has a `_tag` you can match on. No `NaN` surprises, no silent infinities
- **Runtime policies via `Layer`** — inject precision enforcement, backend selection, and diagnostics tracing without changing call sites
- **Schema-validated boundaries** — `onExcessProperty: "error"` at every public decode edge
- **Pure kernels** — hot-path functions are synchronous with no Effect overhead. Wrap them in Effect only when you need policies or typed error channels
- **No native deps** — pure TypeScript. Just `effect` as a peer dependency

## Installation

```sh
npm install effect-math
# or
bun add effect-math
```

Peer dependency: `effect >= 3.20.0`

## Quick start

Pure kernels work directly — no Effect runtime needed:

```ts typecheck
import { Chunk } from "effect"
import { dot, normL2, vectorAdd } from "effect-math/LinearAlgebra"
import { euclideanDistance } from "effect-math/Geometry"
import {
  lossSummary,
  mean,
  normalizeBeneficial,
  normalizeInverseBudget,
  variance,
  weightedMean
} from "effect-math/Statistics"
import { normalPdf, standardNormalCdf } from "effect-math/Probability"
import { gamma, erf, beta } from "effect-math/Special"
import { normalCdf as distNormalCdf, betaMean, poissonPmf } from "effect-math/Distribution"
import { TAU, degreesToRadians, hypot, imul, sin as scalarSin } from "effect-math/Numeric"
import { of, add, abs, sin, complexDerivative } from "effect-math/Complex"
import { circularConvolution, rfft } from "effect-math/Fft"
import { solveAdaptiveRk45, solveRk4 } from "effect-math/Calculus"

const a = Chunk.fromIterable([1, 2, 3])
const b = Chunk.fromIterable([4, 5, 6])

dot(a, b) // 32
normL2(a) // √14
vectorAdd(a, b) // Chunk(5, 7, 9)

euclideanDistance(Chunk.fromIterable([0, 0]), Chunk.fromIterable([3, 4])) // 5

mean(Chunk.fromIterable([2, 4, 6])) // 4
variance(Chunk.fromIterable([2, 4, 6])) // 4
weightedMean(Chunk.make(0.9, 0.6, 0.3), Chunk.make(2, 1, 1)) // 0.675
normalizeBeneficial(75, { minimum: 50, maximum: 100 }) // 0.5
normalizeInverseBudget(75, { budget: 100 }) // 0.25
lossSummary(Chunk.make(0.1, 0.2, 0.5)).mean // ≈ 0.2667

normalPdf(0, 0, 1) // ≈ 0.3989
standardNormalCdf(0) // 0.5

gamma(5) // 24 (= 4!)
gamma(0.5) // √π ≈ 1.7725
erf(1) // ≈ 0.8427
beta(0.5, 0.5) // π

distNormalCdf(1.96, 0, 1) // ≈ 0.975
betaMean(2, 5) // ≈ 0.2857
poissonPmf(3, 5) // ≈ 0.1404

TAU // 2π
degreesToRadians(180) // π
scalarSin(TAU / 4) // 1
hypot(3, 4) // 5
imul(0x7fffffff, 2) // -2

const z = add(of(1, 2), of(3, 4)) // 4 + 6i
abs(of(3, 4)) // 5
sin(of(1, 1)) // sin(1)cosh(1) + i·cos(1)sinh(1)
complexDerivative(sin, 0) // cos(0) = 1 (machine-precision)

const spectrum = rfft(Chunk.fromIterable([0, 1, 0, -1]))
spectrum.signalLength // 4

circularConvolution(Chunk.fromIterable([1, 2, 1, 0]), Chunk.fromIterable([1, 0, -1, 0])) // Chunk(0, 2, 0, -2)

solveRk4((_time, state) => Chunk.fromIterable([Chunk.unsafeGet(state, 1), -Chunk.unsafeGet(state, 0)]), {
  initialTime: 0,
  finalTime: 1,
  initialState: Chunk.fromIterable([1, 0]),
  stepSize: 0.05
}) // finalState ≈ [cos(1), -sin(1)]

solveAdaptiveRk45((_time, state) => Chunk.fromIterable([-Chunk.unsafeGet(state, 0)]), {
  initialTime: 0,
  finalTime: 1,
  initialState: Chunk.fromIterable([1]),
  initialStep: 0.1,
  maxStep: 0.2,
  absoluteTolerance: 1e-8,
  relativeTolerance: 1e-8
}) // finalState ≈ [e^-1]
```

When you need precision enforcement or diagnostics, use policy-aware operations — they read runtime services from the Effect context:

```ts
import { Chunk, Effect, Layer } from "effect"
import { dotWithPolicies } from "effect-math/LinearAlgebra"
import { BackendPolicyService, DiagnosticsPolicyService, PrecisionPolicyService } from "effect-math/contracts"

const program = Effect.gen(function* () {
  const a = Chunk.fromIterable([1, 2, 3])
  const b = Chunk.fromIterable([4, 5, 6])
  return yield* dotWithPolicies(a, b) // 32
})

const policies = Layer.mergeAll(
  Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
  Layer.succeed(BackendPolicyService, { policy: "scalar" }),
  Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
)

Effect.runSync(program.pipe(Effect.provide(policies)))
```

Under `"strict"` precision, non-finite results fail with a typed error instead of silently returning `NaN` or `Infinity`.

### Selected workflows

- **FFT** — `rfft`, `irfft`, and `circularConvolution` keep one real-signal and convolution path over `Chunk<number>` carriers. See [`examples/11-fft-transforms.ts`](./examples/11-fft-transforms.ts).
- **Optimization** — `brent`, `secant`, `newtonRaphson`, `findRootValidated`, and `findRootWithPolicies` share one canonical result envelope and reuse autodiff authority when Newton-Raphson omits an explicit derivative. See [`examples/09-optimization-solvers.ts`](./examples/09-optimization-solvers.ts).
- **Statistics and Distribution** — `MeanConfidenceIntervalReport`, `TTestReport`, `PowerAnalysisReport`, `SampleSizeForTargetPowerReport`, `confidenceIntervalMean`, `oneSampleTTest`, `twoSampleTTest`, `powerForMeanDifference`, `sampleSizeForTargetPower`, `noncentralTCdf`, and `noncentralTQuantile` now cover inferential and power-analysis workflows on package-owned report and distribution surfaces. See [`examples/12-statistics-inference.ts`](./examples/12-statistics-inference.ts).
- **ODE** — `solveEuler`, `solveRk4`, and `solveAdaptiveRk45` keep the released sample cadence on `Chunk<number>` state carriers while policy-aware entrypoints still route through shared computation dispatch. See [`examples/08-calculus-numerical.ts`](./examples/08-calculus-numerical.ts).

## Domains

Each domain is a self-contained subpath export with its own schemas, typed errors, and operations.

| Domain            | Import                      | What it does                                                                                                                                                                                                                                                                             |
| ----------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Numeric**       | `effect-math/Numeric`       | Real-scalar leaf math — `PI`, `TAU`, angle conversion, circular and hyperbolic trig, `hypot`, IEEE-754 rounding, deterministic `imul`, plus safe division and log/exp transforms                                                                                                         |
| **LinearAlgebra** | `effect-math/LinearAlgebra` | Dense vector/matrix — dot, norms, matvec, transpose                                                                                                                                                                                                                                      |
| **Geometry**      | `effect-math/Geometry`      | Distances (Euclidean, Manhattan, Chebyshev), midpoint, centroid                                                                                                                                                                                                                          |
| **Probability**   | `effect-math/Probability`   | Normal and uniform PDF/CDF, Shannon entropy                                                                                                                                                                                                                                              |
| **Statistics**    | `effect-math/Statistics`    | Mean, variance, standard deviation, covariance, min/max, generic weighted aggregation, bounded normalization, loss summaries, confidence intervals, t-tests, power analysis, and sample-size inversion                                                                                   |
| **Special**       | `effect-math/Special`       | Gamma, beta, erf/erfc, digamma (Lanczos, A&S 7.1.26)                                                                                                                                                                                                                                     |
| **Algebra**       | `effect-math/Algebra`       | Polynomial eval/derivative, GCD, LCM, factorial                                                                                                                                                                                                                                          |
| **Calculus**      | `effect-math/Calculus`      | Derivative limits (`derivativeLimit`, `secondDerivativeLimit`), scalar derivatives, multivariate operators (gradient/Jacobian/Hessian/directional/divergence/laplacian), trapezoid/Simpson/adaptive-Simpson integration, and ODE solvers (`solveEuler`, `solveRk4`, `solveAdaptiveRk45`) |
| **Optimization**  | `effect-math/Optimization`  | Bisection root-finding, golden section minimization, and canonical Brent/secant/Newton-Raphson result-envelope solving                                                                                                                                                                   |
| **Distribution**  | `effect-math/Distribution`  | 11-family algebra — Normal, LogNormal, Exponential, Uniform, Beta, Gamma, Student-t, Noncentral-t, Categorical, Binomial, Poisson with PDF/CDF, quantile, mean, variance, and entropy                                                                                                    |
| **Complex**       | `effect-math/Complex`       | Complex arithmetic, trig, polar, Chunk carriers, complex-step derivative                                                                                                                                                                                                                 |
| **Fft**           | `effect-math/Fft`           | Complex FFT, Hermitian real-spectrum FFT, and circular convolution over `Chunk<number>` carriers                                                                                                                                                                                         |

Internal modules are blocked from import via the package `exports` map.

## Runtime policies

Policy-aware operations read configuration from Effect services. Compose the policies you need using `Layer`:

| Service                    | Values                                   | What it controls                                    |
| -------------------------- | ---------------------------------------- | --------------------------------------------------- |
| `PrecisionPolicyService`   | `"strict"` / `"relaxed"`                 | Strict rejects non-finite results as typed errors   |
| `BackendPolicyService`     | `"typed-array"` / `"scalar"`             | Execution strategy for dense operations             |
| `DiagnosticsPolicyService` | `"enabled"` / `"disabled"`               | `Effect.logDebug` with timing and metadata          |
| `RngPolicyService`         | `"deterministic"` / `"nondeterministic"` | Deterministic requires a `Seed` for reproducibility |

`makeDeterministicRuntimePoliciesLayer` builds all four from a single config object — useful for reproducible test fixtures.

## Error handling

Every domain defines typed errors using `Schema.TaggedError`. Match on `_tag` to handle specific failures:

```ts
import { Chunk, Effect, Layer } from "effect"
import { normWithPolicies } from "effect-math/LinearAlgebra"
import { DiagnosticsPolicyService, PrecisionPolicyService } from "effect-math/contracts"

const program = normWithPolicies(Chunk.fromIterable([Infinity, 1]), "L2").pipe(
  Effect.catchTag("LinearAlgebraDomainViolationError", (e) => Effect.succeed(`caught: ${e.message}`)),
  Effect.provide(
    Layer.mergeAll(
      Layer.succeed(PrecisionPolicyService, { policy: "strict" }),
      Layer.succeed(DiagnosticsPolicyService, { policy: "disabled" })
    )
  )
)
```

| Domain        | Error                        | Raised when                                |
| ------------- | ---------------------------- | ------------------------------------------ |
| LinearAlgebra | `ShapeMismatchError`         | Dimension incompatibility between operands |
|               | `SingularMatrixError`        | Matrix is rank-deficient                   |
|               | `DecompositionError`         | Factorization cannot complete              |
| Geometry      | `GeometryShapeMismatchError` | Point dimensions don't match               |
|               | `GeometryDegenerateError`    | Degenerate geometric configuration         |
| Probability   | `ProbabilityParameterError`  | Invalid distribution parameters            |
| Statistics    | `StatisticsShapeError`       | Too few observations for the estimator     |
| Special       | `SpecialParameterError`      | Invalid parameters (e.g., gamma at poles)  |
| Distribution  | `DistributionDecodeError`    | Schema decode failure for operation input  |
|               | `DistributionParameterError` | Invalid parameters (e.g., σ ≤ 0)           |
| Complex       | `ComplexDivisionByZeroError` | Division by zero complex number            |
|               | `ComplexDomainError`         | Invalid domain (e.g., log of zero)         |

Each domain also defines a `DomainViolationError` raised under `"strict"` precision when an operation produces a non-finite result.

## API at a glance

```ts
// Pure kernels — no Effect wrapper
import { dot, normL2, vectorAdd, vectorScale, matvec, transpose, frobeniusNorm } from "effect-math/LinearAlgebra"
import { euclideanDistance, manhattanDistance, chebyshevDistance, midpoint } from "effect-math/Geometry"
import {
  confidenceIntervalMean,
  lossSummary,
  mean,
  oneSampleTTest,
  powerForMeanDifference,
  sampleSizeForTargetPower,
  twoSampleTTest,
  variance,
  standardDeviation,
  covariance,
  minimum,
  maximum,
  weightedMean,
  normalizeBeneficial,
  normalizeInverseBudget
} from "effect-math/Statistics"
import { normalPdf, normalCdf, uniformPdf, uniformCdf, shannonEntropy } from "effect-math/Probability"
import {
  PI,
  TAU,
  E,
  LN_2,
  SQRT_2,
  EPSILON,
  degreesToRadians,
  radiansToDegrees,
  sin,
  cos,
  tan,
  asin,
  acos,
  atan,
  atan2,
  sinh,
  cosh,
  tanh,
  asinh,
  acosh,
  atanh,
  hypot,
  floor,
  ceil,
  round,
  trunc,
  imul,
  safeDivide,
  log,
  log1p,
  exp,
  expm1,
  sum,
  abs as scalarAbs,
  sqrt as scalarSqrt,
  clamp,
  between
} from "effect-math/Numeric"
import { gamma, lnGamma, beta, erf, erfc, digamma } from "effect-math/Special"
import { polyEval, polyDerivative, gcd, lcm, factorial } from "effect-math/Algebra"
import {
  derivativeLimit,
  secondDerivativeLimit,
  derivative,
  secondDerivative,
  gradient,
  jacobian,
  hessian,
  directionalDerivative,
  divergence,
  laplacian,
  trapezoid,
  simpson,
  adaptiveSimpson,
  solveEuler,
  solveRk4,
  solveAdaptiveRk45
} from "effect-math/Calculus"
import { bisect, brent, findRoot, goldenSection, newtonRaphson, secant } from "effect-math/Optimization"
import {
  normalPdf as dNormalPdf,
  normalCdf as dNormalCdf,
  normalQuantile,
  betaPdf,
  betaCdf,
  betaQuantile,
  gammaPdf,
  gammaCdf,
  exponentialPdf,
  noncentralTCdf,
  noncentralTQuantile,
  uniformPdf,
  studentTPdf,
  categoricalPmf,
  binomialPmf,
  poissonPmf as dPoissonPmf,
  normalMean,
  normalVariance,
  normalEntropy as dNormalEntropy,
  betaMean as dBetaMean,
  gammaMean
} from "effect-math/Distribution"
import {
  of,
  add,
  multiply,
  divide,
  conjugate,
  abs,
  arg,
  exp,
  log,
  pow,
  sqrt,
  sin,
  cos,
  tan,
  sinh,
  cosh,
  tanh,
  toPolar,
  fromPolar,
  complexDerivative,
  complexDot,
  complexNorm,
  complexScale,
  fromRealChunk,
  toRealChunk
} from "effect-math/Complex"
import { circularConvolution, fft, fromRealSignal, ifft, irfft, rfft, toComplexChunk } from "effect-math/Fft"

// Policy-aware — read runtime services from Effect context
import { dotWithPolicies, normWithPolicies } from "effect-math/LinearAlgebra"
import { distanceWithPolicies } from "effect-math/Geometry"
import {
  confidenceIntervalMeanWithPolicies,
  oneSampleTTestWithPolicies,
  powerForMeanDifferenceWithPolicies,
  sampleSizeForTargetPowerWithPolicies,
  summaryStatisticsWithPolicies,
  meanWithPolicies,
  twoSampleTTestWithPolicies,
  varianceWithPolicies,
  covarianceWithPolicies
} from "effect-math/Statistics"
import {
  normalPdfWithPolicies,
  normalCdfWithPolicies,
  uniformPdfWithPolicies,
  uniformCdfWithPolicies,
  entropyWithPolicies
} from "effect-math/Probability"
import { sumWithPolicies } from "effect-math/Numeric"
import {
  gammaWithPolicies,
  erfWithPolicies,
  lnGammaWithPolicies,
  betaWithPolicies,
  erfcWithPolicies,
  digammaWithPolicies
} from "effect-math/Special"
import {
  polyEvalWithPolicies,
  factorialWithPolicies,
  polyDerivativeWithPolicies,
  gcdWithPolicies,
  lcmWithPolicies
} from "effect-math/Algebra"
import {
  derivativeLimitWithPolicies,
  secondDerivativeLimitWithPolicies,
  derivativeWithPolicies,
  secondDerivativeWithPolicies,
  gradientWithPolicies,
  jacobianWithPolicies,
  hessianWithPolicies,
  directionalDerivativeWithPolicies,
  divergenceWithPolicies,
  laplacianWithPolicies,
  trapezoidWithPolicies,
  simpsonWithPolicies,
  adaptiveSimpsonWithPolicies,
  solveEulerWithPolicies,
  solveRk4WithPolicies,
  solveAdaptiveRk45WithPolicies
} from "effect-math/Calculus"
import { bisectWithPolicies, findRootWithPolicies, goldenSectionWithPolicies } from "effect-math/Optimization"
import {
  betaCdfWithPolicies,
  noncentralTCdfWithPolicies,
  noncentralTQuantileWithPolicies,
  normalCdfWithPolicies,
  normalPdfWithPolicies
} from "effect-math/Distribution"
import {
  circularConvolutionWithPolicies,
  fftWithPolicies,
  ifftWithPolicies,
  irfftWithPolicies,
  rfftWithPolicies
} from "effect-math/Fft"

// Runtime policy services and layer constructors
import {
  PrecisionPolicyService,
  BackendPolicyService,
  DiagnosticsPolicyService,
  RngPolicyService,
  makeDeterministicRuntimePoliciesLayer
} from "effect-math/contracts"
```

## Status

| Tier            | Domains                                                                                                                         | Meaning                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Provisional** | Numeric, LinearAlgebra, Geometry, Probability, Statistics, Special, Algebra, Calculus, Optimization, Distribution, Complex, Fft | Functional and tested, may evolve |

## Calculus Fixture Provenance

Calculus parity fixtures are mixed-source by operation. `trapezoid`, `simpson`, and `adaptiveSimpson` expectations are generated from SciPy/NumPy reference calls (`numpy.trapz`, `scipy.integrate.simpson`, `scipy.integrate.quad`) in `packages/effect-math/scripts/fixtures/calculus.py`. `derivative`, `secondDerivative`, and multivariate operators (`gradient`, `jacobian`, `hessian`, `directionalDerivative`, `divergence`, `laplacian`) use analytic/reference formulations in the same generator because there is no one-to-one SciPy operator call for those exact contracts.

## Acknowledgments

Gamma and log-gamma use the [Lanczos approximation](https://doi.org/10.1137/0701008) (g = 7, 9 coefficients from [Godfrey, 2001](http://www.numericana.com/answer/info/godfrey.htm)). Error function uses multi-region rational polynomial coefficients from the [Cephes Mathematical Library](https://www.netlib.org/cephes/) (Moshier, 1984–2000; BSD license — see `THIRD_PARTY_NOTICES`). Inverse error function uses rational Chebyshev approximations from [Blair, Edwards & Johnson (1976)](https://doi.org/10.1090/S0025-5718-1976-0421040-7) via [Boost.Math](https://www.boost.org/doc/libs/release/libs/math/) (Maddock, 2006; Boost Software License 1.0 applies to coefficient tables). Regularized incomplete gamma and beta use series expansion and modified Lentz continued fractions ([Lentz, 1976](https://doi.org/10.1364/AO.15.000668); [Thompson & Barnett, 1986](<https://doi.org/10.1016/0021-9991(86)90001-8>)). Polygamma uses recurrence shifting and asymptotic expansion with Bernoulli numbers per A&S §6.4. Digamma uses asymptotic expansion per A&S §6.3.18. Compensated summation follows [Kahan (1965)](https://doi.org/10.1145/363707.363723). Golden section search follows [Kiefer (1953)](https://doi.org/10.2307/2032161). Complex-step differentiation follows [Squire & Trapp (1998)](https://doi.org/10.1137/S003614459631241X). Complex division uses the [Smith (1962)](https://doi.org/10.1145/368637.368661) method for overflow safety. Beta, Gamma, and Student's t quantiles use Newton–Raphson iteration on the CDF inverse. Numerical kernels are verified against SciPy/NumPy fixtures where those APIs are authoritative and analytic/reference fixtures where direct SciPy parity is not applicable.

## Contributing

See the [repository](https://github.com/scenesystems/theoria) for contribution guidelines.

```sh
bun run check    # Type check
bun run test     # Run tests
bun run lint     # ESLint with Effect rules
bun run build    # ESM + CJS + annotate-pure-calls
```

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
