/**
 * Computes descriptive statistics from immutable chunks, decodes boundary
 * arrays through Schema, and collects the policy-aware summary result.
 *
 * Run: bun run packages/effect-math/examples/05-statistics-summary.ts
 * @module
 */
import { BunRuntime } from "@effect/platform-bun"
import { Array, Chunk, Console, Effect } from "effect"

import * as Policy from "@scenesystems/effect-math/Policy"
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
  const data = Chunk.make(2, 4, 4, 4, 5, 5, 7, 9)

  // Direct kernels
  yield* Console.log("mean:", mean(data))
  // Output: mean: 5
  yield* Console.log("variance:", variance(data))
  yield* Console.log("standardDeviation:", standardDeviation(data))

  const xs = Chunk.make(1, 2, 3, 4, 5)
  const ys = Chunk.make(2, 4, 5, 4, 5)
  yield* Console.log("covariance:", covariance(xs, ys))
  // Output: covariance: 1.5

  // Schema-validated boundary
  const meanV = yield* meanValidated({ values: Array.make(10, 20, 30) })
  yield* Console.log("meanValidated:", meanV)

  const varV = yield* varianceValidated({ values: Array.make(2, 4, 4, 4, 5, 5, 7, 9) })
  yield* Console.log("varianceValidated:", varV)

  const covV = yield* covarianceValidated({ a: Array.make(1, 2, 3, 4, 5), b: Array.make(2, 4, 5, 4, 5) })
  yield* Console.log("covarianceValidated:", covV)

  const summary = yield* summaryStatisticsValidated({ values: Array.make(2, 4, 4, 4, 5, 5, 7, 9) })
  yield* Console.log("summaryStatisticsValidated:", summary)

  // Strict precision with diagnostics
  const policies = Policy.layerDeterministic({
    seed: Policy.Seed.make(42),
    precision: "strict",
    backend: "compensated",
    diagnostics: "enabled"
  })

  const summaryP = yield* summaryStatisticsWithPolicies(data).pipe(
    Effect.provide(policies)
  )
  yield* Console.log("summaryStatisticsWithPolicies:", summaryP)
})

BunRuntime.runMain(program)
