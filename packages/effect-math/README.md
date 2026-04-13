# `effect-math`

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Effect](https://img.shields.io/badge/built_with-Effect-black)](https://effect.website)

Foundational numerics, statistics, optimization, and scientific computing for Effect.

Use it when you want pure kernels for hot paths, typed reports for analytical work, and policy-aware execution when results need reproducibility or runtime enforcement.

## Why Use It

- Pure kernels stay synchronous and fast, so you can use them directly in scoring, simulation, and data-processing paths.
- Typed boundaries replace silent `NaN` drift and ad hoc validation with schema-backed inputs and tagged errors.
- `Chunk<number>` carriers keep dense math immutable and composable with the rest of the Effect ecosystem.
- `effect-math/contracts` lets you inject deterministic RNG, strict precision, backend choice, and diagnostics without rewriting call sites.

## Installation

```sh
npm install effect-math effect
```

Use `bun add` or `pnpm add` if that is your package manager.

## Quick Start

This is a small research-analysis path: summarize study scores, normalize them for comparison, estimate statistical power, and keep a few numerical helpers nearby for geometry and scalar work.

```ts typecheck
import { Chunk } from "effect"
import { euclideanDistance } from "effect-math/Geometry"
import { TAU, acosh, atan2, degreesToRadians, imul } from "effect-math/Numeric"
import {
  lossSummary,
  mean,
  normalizeBeneficial,
  normalizeInverseBudget,
  powerForMeanDifference,
  sampleSizeForTargetPower,
  weightedMean
} from "effect-math/Statistics"

const bridgeScores = Chunk.make(0.72, 0.81, 0.76)
const confidenceWeights = Chunk.make(3, 2, 4)

const coordination = weightedMean(bridgeScores, confidenceWeights)
const averageScore = mean(bridgeScores)
const agreement = normalizeBeneficial(81, { minimum: 50, maximum: 100 })
const costPenalty = normalizeInverseBudget(42, { budget: 80 })
const trainingLoss = lossSummary(Chunk.make(0.12, 0.18, 0.15))
const corridorLength = euclideanDistance(Chunk.make(0, 0), Chunk.make(3, 4))

const heading = atan2(3, 4)
const halfTurn = degreesToRadians(180) === TAU / 2
const shape = acosh(2)
const deterministicStep = imul(65_537, 17)

const powerReport = powerForMeanDifference(0.45, 24, {
  alpha: 0.05,
  alternative: "twoSided"
})

const sampleSizeReport = sampleSizeForTargetPower(0.45, 0.8, {
  alpha: 0.05,
  alternative: "twoSided",
  maxSampleSize: 256
})

void {
  coordination,
  averageScore,
  agreement,
  costPenalty,
  trainingLoss,
  corridorLength,
  heading,
  halfTurn,
  shape,
  deterministicStep,
  powerReport,
  sampleSizeReport
}
```

When you need runtime enforcement or deterministic execution, add a policy layer instead of switching APIs.

```ts typecheck
import { Chunk, Effect } from "effect"
import { dotWithPolicies } from "effect-math/LinearAlgebra"
import { powerForMeanDifferenceWithPolicies } from "effect-math/Statistics"
import { Seed, makeDeterministicRuntimePoliciesLayer } from "effect-math/contracts"

const policies = makeDeterministicRuntimePoliciesLayer({
  seed: Seed.make(42),
  precision: "strict",
  backend: "scalar",
  diagnostics: "disabled"
})

const program = Effect.all([
  dotWithPolicies(Chunk.make(1, 2, 3), Chunk.make(4, 5, 6)),
  powerForMeanDifferenceWithPolicies(0.45, 24, {
    alpha: 0.05,
    alternative: "twoSided"
  })
]).pipe(Effect.provide(policies))

void program
```

## Main Things You Can Do

| Task | Start here |
| --- | --- |
| Study summaries and inferential reports | `effect-math/Statistics` for `weightedMean`, `normalizeBeneficial`, `normalizeInverseBudget`, `lossSummary`, and the report-returning `powerForMeanDifference` / `sampleSizeForTargetPower` workflow (`PowerAnalysisReport`, `SampleSizeForTargetPowerReport`) |
| Dense vectors and geometry | `effect-math/LinearAlgebra` and `effect-math/Geometry` for dot products, norms, matrix operations, and metric distances |
| Scalar and numerical primitives | `effect-math/Numeric` for `TAU`, `degreesToRadians`, `atan2`, `acosh`, `imul`, rounding helpers, and safe scalar transforms |
| Probability and applied distributions | `effect-math/Probability` and `effect-math/Distribution` for PDF/CDF work, quantiles, entropy, and named statistical families |
| Special functions and algebra | `effect-math/Special` and `effect-math/Algebra` for gamma/beta/erf work, polynomial evaluation, and discrete helpers |
| Calculus and optimization | `effect-math/Calculus` and `effect-math/Optimization` for derivatives, quadrature, ODEs, root-finding, and minimization |
| Complex arithmetic and spectra | `effect-math/Complex` and `effect-math/Fft` for complex numbers, real-signal FFTs, and circular convolution; start with [`examples/11-fft-transforms.ts`](./examples/11-fft-transforms.ts) |

## Learn More

- Start with [`examples/08-calculus-numerical.ts`](./examples/08-calculus-numerical.ts) for derivatives, quadrature, and ODEs.
- Use [`examples/09-optimization-solvers.ts`](./examples/09-optimization-solvers.ts) for Brent, secant, and Newton-Raphson workflows.
- Use [`examples/11-fft-transforms.ts`](./examples/11-fft-transforms.ts) for `effect-math/Fft` and [`examples/12-statistics-inference.ts`](./examples/12-statistics-inference.ts) for `effect-math/Statistics` inference and power analysis.
- From the repository root, run `bun run docs:packages -- --package effect-math --view agent` for the generated docs surface.

## License

[MIT](./LICENSE) — Copyright © 2026 Scene Systems
