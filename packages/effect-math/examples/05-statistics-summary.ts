/**
 * Computes descriptive statistics from immutable chunks, decodes boundary
 * arrays through Schema, and collects the policy-aware summary result.
 *
 * Run: bun run packages/effect-math/examples/05-statistics-summary.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "@scenesystems/effect-math/contracts"
import {
  covariance,
  covarianceValidated,
  mean,
  meanValidated,
  standardDeviation,
  summaryStatisticsValidated,
  summaryStatisticsWithPolicies,
  variance,
  varianceValidated
} from "@scenesystems/effect-math/Statistics"

const program = Effect.gen(function*() {
  const data = Chunk.fromIterable([2, 4, 4, 4, 5, 5, 7, 9])

  // Direct kernels
  yield* Console.log("mean:", mean(data))
  // Output: mean: 5
  yield* Console.log("variance:", variance(data))
  yield* Console.log("standardDeviation:", standardDeviation(data))

  const xs = Chunk.fromIterable([1, 2, 3, 4, 5])
  const ys = Chunk.fromIterable([2, 4, 5, 4, 5])
  yield* Console.log("covariance:", covariance(xs, ys))
  // Output: covariance: 1.5

  // Schema-validated boundary
  const meanV = yield* meanValidated({ values: [10, 20, 30] })
  yield* Console.log("meanValidated:", meanV)

  const varV = yield* varianceValidated({ values: [2, 4, 4, 4, 5, 5, 7, 9] })
  yield* Console.log("varianceValidated:", varV)

  const covV = yield* covarianceValidated({ a: [1, 2, 3, 4, 5], b: [2, 4, 5, 4, 5] })
  yield* Console.log("covarianceValidated:", covV)

  const summary = yield* summaryStatisticsValidated({ values: [2, 4, 4, 4, 5, 5, 7, 9] })
  yield* Console.log("summaryStatisticsValidated:", {
    _tag: summary._tag,
    mean: summary.mean,
    variance: summary.variance,
    standardDeviation: summary.standardDeviation,
    min: summary.min,
    max: summary.max,
    count: summary.count
  })

  // Strict precision with diagnostics
  const policies = makeDeterministicRuntimePoliciesLayer({
    seed: Seed.make(42),
    precision: "strict",
    backend: "typed-array",
    diagnostics: "enabled"
  })

  const summaryP = yield* summaryStatisticsWithPolicies(data).pipe(
    Effect.provide(policies)
  )
  yield* Console.log("summaryStatisticsWithPolicies:", {
    _tag: summaryP._tag,
    mean: summaryP.mean,
    variance: summaryP.variance,
    standardDeviation: summaryP.standardDeviation,
    min: summaryP.min,
    max: summaryP.max,
    count: summaryP.count
  })
})

BunRuntime.runMain(program)
