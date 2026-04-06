import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect, Number, Schema } from "effect"
import * as Arr from "effect/Array"

import { fft, fromRealSignal } from "../../src/Fft/index.js"

const BenchmarkBudgetSchema = Schema.Struct({
  maxDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const BenchmarkPlanSchema = Schema.Struct({
  runs: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  maxMeanDurationMs: Schema.Number.pipe(Schema.greaterThan(0))
})

const powerOfTwoSignal = Chunk.fromIterable(Arr.map(Arr.range(0, 31), (index) => Math.sin(index / 3)))
const primeLengthSignal = Chunk.fromIterable(Arr.map(Arr.range(0, 30), (index) => Math.cos(index / 5)))

describe("Fft benchmark guard", () => {
  it.effect("keeps canonical power-of-two and prime-length transforms within budget", () =>
    Effect.gen(function*() {
      const budget = yield* Schema.decodeUnknown(BenchmarkBudgetSchema)({
        maxDurationMs: 400
      })
      const plan = yield* Schema.decodeUnknown(BenchmarkPlanSchema)({
        runs: 20,
        maxMeanDurationMs: 10
      })

      const startedAt = performance.now()

      yield* Effect.forEach(
        Arr.range(1, plan.runs),
        () =>
          Effect.sync(() => {
            fft(fromRealSignal(powerOfTwoSignal, "backward"), "backward")
            fft(fromRealSignal(primeLengthSignal, "backward"), "backward")
          }),
        { discard: true }
      )

      const elapsed = performance.now() - startedAt
      const meanDurationMs = elapsed / plan.runs

      expect(Number.Equivalence(meanDurationMs <= plan.maxMeanDurationMs ? 1 : 0, 1)).toStrictEqual(true)
      expect(Number.Equivalence(elapsed <= budget.maxDurationMs ? 1 : 0, 1)).toStrictEqual(true)
    }))
})
