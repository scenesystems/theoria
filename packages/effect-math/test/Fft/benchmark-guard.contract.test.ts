import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"
import * as Arr from "effect/Array"

import { fft, fromRealSignal } from "../../src/Fft/index.js"
import { BenchmarkBudgetSchema, BenchmarkPlanSchema, runBenchmarkPlan } from "../helpers/benchmark.js"

const powerOfTwoSignal = Chunk.fromIterable(Arr.map(Arr.range(0, 31), (index) => Math.sin(index / 3)))
const primeLengthSignal = Chunk.fromIterable(Arr.map(Arr.range(0, 30), (index) => Math.cos(index / 5)))
const powerOfTwoSequence = fromRealSignal(powerOfTwoSignal, "backward")
const primeLengthSequence = fromRealSignal(primeLengthSignal, "backward")

describe("Fft benchmark guard", () => {
  it.effect("keeps canonical power-of-two and prime-length transforms within budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 600
      })
      const plan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 40,
        maxMeanDurationMs: 10
      })

      const benchmark = yield* runBenchmarkPlan(plan, () =>
        Effect.sync(() => {
          fft(powerOfTwoSequence, "backward")
          fft(primeLengthSequence, "backward")
        }))

      expect(Number.Equivalence(benchmark.meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(benchmark.elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
