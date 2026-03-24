/**
 * Effectful metric constructor contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect, Ref } from "effect"
import * as Metric from "effect-dsp/Metric"

describe("Metric.fromEffect", () => {
  it.effect("constructs an effectful scorer with deterministic side effects", () =>
    Effect.gen(function*() {
      const calls = yield* Ref.make(0)

      const metric = Metric.fromEffect("judge", (prediction, expected) =>
        Effect.gen(function*() {
          yield* Ref.update(calls, (current) => current + 1)

          return new Metric.Result({
            score: prediction.answer === expected.answer ? 1 : 0
          })
        }))

      const score = yield* metric.score(
        { answer: "Paris" },
        { answer: "Paris" }
      )
      const count = yield* Ref.get(calls)

      expect(score.score).toBe(1)
      expect(count).toBe(1)
    }))

  it.effect("preserves optional feedback on metric results", () =>
    Effect.gen(function*() {
      const metric = Metric.fromEffect("feedback", () =>
        Effect.succeed(
          new Metric.Result({
            score: 0.5,
            feedback: "Partially correct"
          })
        ))

      const score = yield* metric.score(
        { answer: "Paris" },
        { answer: "Paris" }
      )

      expect(score.score).toBe(0.5)
      expect(score.feedback).toBe("Partially correct")
    }))
})
