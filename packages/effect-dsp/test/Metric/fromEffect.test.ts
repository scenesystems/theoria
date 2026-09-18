/**
 * Effectful metric constructor contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Boolean, Effect, Equal, Number, Ref, Schema } from "effect"

const Output = Schema.Struct({ answer: Schema.String })

describe("Metric.fromEffect", () => {
  it.effect("constructs an effectful scorer with deterministic side effects", () =>
    Effect.gen(function*() {
      const calls = yield* Ref.make(0)

      const metric = Metric.fromEffect("judge", (prediction: typeof Output.Type, expected) =>
        Effect.gen(function*() {
          yield* Ref.update(calls, Number.increment)

          return new Metric.Result({
            score: Boolean.match(Equal.equals(prediction.answer, expected.answer), {
              onTrue: () => 1,
              onFalse: () => 0
            })
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
