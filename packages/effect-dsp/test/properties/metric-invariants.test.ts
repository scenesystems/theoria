/**
 * Property-style invariants for metric range and determinism.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Effect, Schema } from "effect"
import * as Arbitrary from "effect/Arbitrary"
import { score } from "../kit/Metric.js"

const stringArbitrary = Arbitrary.schema(Schema.String)

describe("metric invariants", () => {
  it.effect.prop("built-ins always stay within their legal score ranges", [
    stringArbitrary,
    stringArbitrary,
    stringArbitrary,
    stringArbitrary
  ], ([predictionA, expectedA, predictionB, expectedB]) =>
    Effect.gen(function*() {
      const exact = Metric.exactMatch("answer")
      const f1 = Metric.f1("answer")
      const contains = Metric.contains("answer", "needle")
      const exactScore = yield* score(exact, { answer: expectedA }, { answer: predictionA })
      const f1Score = yield* score(f1, { answer: expectedB }, { answer: predictionB })
      const containsScore = yield* score(contains, { answer: expectedA }, { answer: predictionA })

      expect(exactScore.value === 0 || exactScore.value === 1).toBe(true)
      expect(f1Score.value >= 0).toBe(true)
      expect(f1Score.value <= 1).toBe(true)
      expect(containsScore.value === 0 || containsScore.value === 1).toBe(true)
    }), { arbitrary: { runs: 100 } })

  it.effect.prop(
    "built-ins are deterministic for identical inputs",
    [stringArbitrary, stringArbitrary],
    ([prediction, expected]) =>
      Effect.gen(function*() {
        const exact = Metric.exactMatch("answer")
        const f1 = Metric.f1("answer")
        const contains = Metric.contains("answer", "needle")
        const exactFirst = yield* score(exact, { answer: expected }, { answer: prediction })
        const exactSecond = yield* score(exact, { answer: expected }, { answer: prediction })
        const f1First = yield* score(f1, { answer: expected }, { answer: prediction })
        const f1Second = yield* score(f1, { answer: expected }, { answer: prediction })
        const containsFirst = yield* score(contains, { answer: expected }, { answer: prediction })
        const containsSecond = yield* score(contains, { answer: expected }, { answer: prediction })

        expect(exactFirst).toEqual(exactSecond)
        expect(f1First).toEqual(f1Second)
        expect(containsFirst).toEqual(containsSecond)
      }),
    { arbitrary: { runs: 100 } }
  )
})
