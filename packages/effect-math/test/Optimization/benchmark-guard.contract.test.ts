import { describe, expect, it } from "@effect/vitest"
import { Effect, Number, Schema } from "effect"

import { bisect } from "../../src/Optimization/operations.js"
import { BenchmarkBudgetSchema, BenchmarkPlanSchema, runBenchmarkPlan } from "../helpers/benchmark.js"

const f = (x: number) => x * x - 2

describe("Optimization benchmark guard", () => {
  it.effect("keeps bisect baseline within benchmark budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 300
      })
      const plan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 100,
        maxMeanDurationMs: 2
      })

      const benchmark = yield* runBenchmarkPlan(plan, () => Effect.sync(() => bisect(f, 0, 2)))

      expect(Number.Equivalence(benchmark.meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(benchmark.elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
