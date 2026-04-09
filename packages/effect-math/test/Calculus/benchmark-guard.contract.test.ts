import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"

import { derivativeLimit, gradient, laplacian, trapezoid } from "../../src/Calculus/operations.js"
import { BenchmarkBudgetSchema, BenchmarkPlanSchema, runBenchmarkPlan } from "../helpers/benchmark.js"

const values = Chunk.fromIterable([0, 1, 4, 9, 16])
const point = Chunk.fromIterable([1, 2])

const scalarSurface = (coordinates: Chunk.Chunk<number>) => {
  const x = Chunk.unsafeGet(coordinates, 0)
  const y = Chunk.unsafeGet(coordinates, 1)
  return x * x + 3 * x * y + y * y
}

describe("Calculus benchmark guard", () => {
  it.effect("keeps method-focused calculus kernels within benchmark budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 2000
      })

      const trapezoidPlan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 100,
        maxMeanDurationMs: 2
      })
      const derivativePlan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 120,
        maxMeanDurationMs: 6
      })
      const multivariatePlan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 40,
        maxMeanDurationMs: 20
      })

      const trapezoidBenchmark = yield* runBenchmarkPlan(
        trapezoidPlan,
        () => Effect.sync(() => trapezoid(values, 1))
      )
      const derivativeBenchmark = yield* runBenchmarkPlan(
        derivativePlan,
        () => Effect.sync(() => derivativeLimit(Math.sin, Math.PI / 3))
      )
      const multivariateBenchmark = yield* runBenchmarkPlan(multivariatePlan, () =>
        Effect.sync(() => {
          const gradientValue = gradient(scalarSurface, point)
          const laplacianValue = laplacian(scalarSurface, point)
          return [gradientValue, laplacianValue]
        }))

      const elapsed = trapezoidBenchmark.elapsed + derivativeBenchmark.elapsed + multivariateBenchmark.elapsed

      expect(Number.Equivalence(trapezoidBenchmark.meanDurationMs <= trapezoidPlan.maxMeanDurationMs ? 1 : 0, 1))
        .toStrictEqual(true)
      expect(Number.Equivalence(derivativeBenchmark.meanDurationMs <= derivativePlan.maxMeanDurationMs ? 1 : 0, 1))
        .toStrictEqual(true)
      expect(Number.Equivalence(multivariateBenchmark.meanDurationMs <= multivariatePlan.maxMeanDurationMs ? 1 : 0, 1))
        .toStrictEqual(true)
      expect(Number.Equivalence(elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
