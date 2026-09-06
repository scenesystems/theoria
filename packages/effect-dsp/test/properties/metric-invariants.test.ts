/**
 * Property-style invariants for metric range and determinism.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Effect, FastCheck as fc } from "effect"

const sentenceArbitrary = fc.array(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 6 }).map((
  tokens
) => tokens.join(" "))

describe("metric invariants", () => {
  it.effect.prop("built-ins always stay within their legal score ranges", [
    fc.string(),
    fc.string(),
    sentenceArbitrary,
    sentenceArbitrary
  ], ([predictionA, expectedA, predictionB, expectedB]) =>
    Effect.gen(function*() {
      const exact = Metric.exactMatch("answer")
      const f1 = Metric.f1("answer")
      const contains = Metric.contains("answer", "needle")
      const exactScore = yield* exact.score(
        { answer: predictionA },
        { answer: expectedA }
      )
      const f1Score = yield* f1.score(
        { answer: predictionB },
        { answer: expectedB }
      )
      const containsScore = yield* contains.score(
        { answer: predictionA },
        { answer: expectedA }
      )

      expect(exactScore.score === 0 || exactScore.score === 1).toBe(true)
      expect(f1Score.score >= 0).toBe(true)
      expect(f1Score.score <= 1).toBe(true)
      expect(containsScore.score === 0 || containsScore.score === 1).toBe(true)
    }), { fastCheck: { numRuns: 100 } })

  it.effect.prop(
    "built-ins are deterministic for identical inputs",
    [sentenceArbitrary, sentenceArbitrary],
    ([prediction, expected]) =>
      Effect.gen(function*() {
        const exact = Metric.exactMatch("answer")
        const f1 = Metric.f1("answer")
        const contains = Metric.contains("answer", "needle")
        const exactFirst = yield* exact.score({ answer: prediction }, { answer: expected })
        const exactSecond = yield* exact.score({ answer: prediction }, { answer: expected })
        const f1First = yield* f1.score({ answer: prediction }, { answer: expected })
        const f1Second = yield* f1.score({ answer: prediction }, { answer: expected })
        const containsFirst = yield* contains.score({ answer: prediction }, { answer: expected })
        const containsSecond = yield* contains.score({ answer: prediction }, { answer: expected })

        expect(exactFirst).toEqual(exactSecond)
        expect(f1First).toEqual(f1Second)
        expect(containsFirst).toEqual(containsSecond)
      }),
    { fastCheck: { numRuns: 100 } }
  )
})
