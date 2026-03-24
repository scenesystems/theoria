/**
 * Statistics — mean, variance, standard deviation, covariance, and SummaryStatistics.
 *
 * Descriptive statistics are the first step in any data analysis pipeline.
 * Pure kernels return scalars from `Chunk` carriers; `summaryStatisticsValidated`
 * bundles all descriptors into a `SummaryStatistics` TaggedClass; `summaryStatisticsWithPolicies`
 * reads precision and diagnostics from the Effect context.
 *
 * What this shows: `mean`, `variance`, `standardDeviation`, `covariance`,
 * schema-validated `meanValidated` / `varianceValidated` / `covarianceValidated` /
 * `summaryStatisticsValidated`, and policy-aware `summaryStatisticsWithPolicies`.
 *
 * Feature Type Links:
 * - {@link SummaryStatistics}
 * - {@link Chunk}
 * - {@link Seed}
 * - {@link RuntimePolicies}
 *
 * Run: bun run packages/effect-math/examples/05-statistics-summary.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Chunk, Console, Effect } from "effect"

import { makeDeterministicRuntimePoliciesLayer, Seed } from "effect-math/contracts"
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
} from "effect-math/Statistics"

const program = Effect.gen(function*() {
  const data = Chunk.fromIterable([2, 4, 4, 4, 5, 5, 7, 9])

  // ─── Pure kernels — Chunk in, scalar out ─────────────────────────
  yield* Console.log("mean:", mean(data))
  // Output: mean: 5
  yield* Console.log("variance:", variance(data))
  yield* Console.log("standardDeviation:", standardDeviation(data))

  const xs = Chunk.fromIterable([1, 2, 3, 4, 5])
  const ys = Chunk.fromIterable([2, 4, 5, 4, 5])
  yield* Console.log("covariance:", covariance(xs, ys))
  // Output: covariance: 1.5

  // ─── Schema-validated — boundary input decoded via Schema ─────────
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

  // ─── Policy-aware — strict precision, diagnostics enabled ────────
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
