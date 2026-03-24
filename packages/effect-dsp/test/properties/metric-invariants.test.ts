/**
 * Property-style invariants for metric range and determinism.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Metric from "effect-dsp/Metric"
import fc from "fast-check"

const sentenceArbitrary = fc.array(fc.string({ minLength: 1, maxLength: 8 }), { minLength: 1, maxLength: 6 }).map((
  tokens
) => tokens.join(" "))

describe("metric invariants", () => {
  it.effect("built-ins always stay within their legal score ranges", () =>
    Effect.gen(function*() {
      const exact = Metric.exactMatch("answer")
      const f1 = Metric.f1("answer")
      const contains = Metric.contains("answer", "needle")
      const samples = fc.sample(fc.tuple(fc.string(), fc.string(), sentenceArbitrary, sentenceArbitrary), {
        numRuns: 100
      })

      yield* Effect.forEach(samples, ([predictionA, expectedA, predictionB, expectedB]) =>
        Effect.gen(function*() {
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
        }))
    }))

  it.effect("built-ins are deterministic for identical inputs", () =>
    Effect.gen(function*() {
      const exact = Metric.exactMatch("answer")
      const f1 = Metric.f1("answer")
      const contains = Metric.contains("answer", "needle")
      const samples = fc.sample(fc.tuple(sentenceArbitrary, sentenceArbitrary), { numRuns: 100 })

      yield* Effect.forEach(samples, ([prediction, expected]) =>
        Effect.gen(function*() {
          const exactFirst = yield* exact.score({ answer: prediction }, { answer: expected })
          const exactSecond = yield* exact.score({ answer: prediction }, { answer: expected })
          const f1First = yield* f1.score({ answer: prediction }, { answer: expected })
          const f1Second = yield* f1.score({ answer: prediction }, { answer: expected })
          const containsFirst = yield* contains.score({ answer: prediction }, { answer: expected })
          const containsSecond = yield* contains.score({ answer: prediction }, { answer: expected })

          expect(exactFirst).toEqual(exactSecond)
          expect(f1First).toEqual(f1Second)
          expect(containsFirst).toEqual(containsSecond)
        }))
    }))
})
