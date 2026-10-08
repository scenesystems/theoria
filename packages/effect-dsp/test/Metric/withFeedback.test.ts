import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Boolean, Effect, Equal, Number, Option, Record, Ref, Result, Schema } from "effect"
import { score } from "../kit/Metric.js"

const Output = Schema.Struct({ answer: Schema.String })

describe("Metric.withFeedback", () => {
  it.effect("rejects non-finite scores at the Score boundary", () =>
    Effect.forEach(
      ["NaN", "Infinity", "-Infinity"],
      (text) =>
        Effect.gen(function*() {
          const value = yield* Effect.fromOption(Number.parse(text))
          const result = yield* Schema.decodeEffect(Metric.Score)({ value, feedback: Option.none() }).pipe(
            Effect.result
          )
          expect(Result.isFailure(result)).toBe(true)
        })
    ))

  it.effect("retains effectful scoring and optional feedback", () =>
    Effect.gen(function*() {
      const calls = yield* Ref.make(0)
      const metric = Metric.withFeedback((example, prediction) =>
        Effect.gen(function*() {
          yield* Ref.update(calls, Number.increment)
          const output = yield* Schema.decodeUnknownEffect(Output)(prediction.output)
          const labels = Option.getOrElse(example.labels, Record.empty<string, unknown>)
          return new Metric.Score({
            value: Boolean.match(Equal.equals(output.answer, labels.answer), { onTrue: () => 1, onFalse: () => 0 }),
            feedback: Option.some("checked")
          })
        }), "judge")
      const result = yield* score(metric, { answer: "Paris", rubric: "capital" }, { answer: "Paris" })
      expect(result.value).toBe(1)
      expect(result.feedback).toEqual(Option.some("checked"))
      expect(yield* Ref.get(calls)).toBe(1)
    }))

  it.effect("fromSync receives labels before output and preserves fractional scores", () =>
    Effect.gen(function*() {
      const metric = Metric.fromSync((labels, output) =>
        Boolean.match(Boolean.and(labels.answer === "Paris", output.answer === "Lyon"), {
          onFalse: () => 0,
          onTrue: () => 0.25
        })
      )
      const result = yield* score(metric, { answer: "Paris" }, { answer: "Lyon" })
      expect(result).toEqual(new Metric.Score({ value: 0.25, feedback: Option.none() }))
    }))
})
