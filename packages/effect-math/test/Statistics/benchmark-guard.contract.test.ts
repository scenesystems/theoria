import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"

import { mean } from "../../src/Statistics/operations.js"
import { BenchmarkBudgetSchema, BenchmarkPlanSchema, runBenchmarkPlan } from "../helpers/benchmark.js"

const sample = Chunk.fromIterable([2.1, 4.3, 6.5, 8.7, 10.9])

describe("Statistics benchmark guard", () => {
  it.effect("keeps mean baseline within benchmark budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 300
      })
      const plan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 100,
        maxMeanDurationMs: 2
      })

      const benchmark = yield* runBenchmarkPlan(plan, () => Effect.sync(() => mean(sample)))

      expect(Number.Equivalence(benchmark.meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(benchmark.elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
