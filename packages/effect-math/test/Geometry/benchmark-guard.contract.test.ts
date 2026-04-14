import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"

import { euclideanDistance } from "../../src/Geometry/operations.js"
import { BenchmarkBudgetSchema, BenchmarkPlanSchema, runBenchmarkPlan } from "../helpers/benchmark.js"

const a = Chunk.fromIterable([1.5, 2.3, 3.7])
const b = Chunk.fromIterable([6.2, 7.8, 8.4])

describe("Geometry benchmark guard", () => {
  it.effect("keeps euclidean distance baseline within benchmark budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 300
      })
      const plan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 100,
        maxMeanDurationMs: 2
      })

      const benchmark = yield* runBenchmarkPlan(plan, () => Effect.sync(() => euclideanDistance(a, b)))

      expect(Number.Equivalence(benchmark.meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(benchmark.elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
