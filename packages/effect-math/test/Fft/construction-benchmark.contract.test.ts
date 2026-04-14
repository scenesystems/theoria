import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"
import * as Arr from "effect/Array"

import { fromRealSignal } from "../../src/Fft/index.js"
import { BenchmarkBudgetSchema, BenchmarkPlanSchema, runBenchmarkPlan } from "../helpers/benchmark.js"

const powerOfTwoSignal = Chunk.fromIterable(Arr.map(Arr.range(0, 31), (index) => Math.sin(index / 3)))
const primeLengthSignal = Chunk.fromIterable(Arr.map(Arr.range(0, 30), (index) => Math.cos(index / 5)))

describe("Fft construction benchmark guard", () => {
  it.effect("keeps real-signal sequence lifting within benchmark budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 400
      })
      const plan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 1000,
        maxMeanDurationMs: 0.5
      })

      const benchmark = yield* runBenchmarkPlan(plan, () =>
        Effect.sync(() => {
          fromRealSignal(powerOfTwoSignal, "backward")
          fromRealSignal(primeLengthSignal, "backward")
        }))

      expect(Number.Equivalence(benchmark.meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(benchmark.elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
