/**
 * Metric composition contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Array as Arr, Chunk, Data, Effect, Number, Option, Record, Ref, Result, Schema, Tuple } from "effect"
import { composedScoreMap } from "../../src/internal/metric/compose.js"
import { score } from "../kit/Metric.js"

describe("Metric.compose", () => {
  it.effect("aggregates child metrics into a deterministic score", () =>
    Effect.gen(function*() {
      const accuracy = Metric.exactMatch("answer")
      const mentionsParis = Metric.contains("answer", "Paris")
      const composed = Metric.compose({ accuracy, mentionsParis })

      const result = yield* score(composed, { answer: "Paris" }, { answer: "The capital is Paris." })

      expect(result.value).toBe(0.5)
    }))

  it.effect("returns stable outputs for identical inputs", () =>
    Effect.gen(function*() {
      const composed = Metric.compose({
        exact: Metric.exactMatch("answer"),
        f1: Metric.f1("answer")
      })

      const first = yield* score(composed, { answer: "alpha gamma" }, { answer: "alpha beta" })
      const second = yield* score(composed, { answer: "alpha gamma" }, { answer: "alpha beta" })

      expect(first).toEqual(second)
    }))

  it.effect("orders schema-bound scorers and feedback by name, including empty feedback", () =>
    Effect.gen(function*() {
      const Output = Schema.Struct({ value: Schema.Finite })
      const calls = yield* Ref.make(Arr.empty<string>())
      const metric = (name: string, feedback: string) =>
        Metric.withFeedback((example, prediction) =>
          Effect.gen(function*() {
            yield* Ref.update(calls, Arr.append(name))
            const output = yield* Schema.decodeUnknownEffect(Output)(prediction.output)
            const expected = yield* Schema.decodeUnknownEffect(Output)(Option.getOrElse(example.labels, Record.empty))
            return new Metric.Score({
              value: Number.subtract(output.value, expected.value),
              feedback: Option.some(feedback)
            })
          }), name)
      const composed = Metric.compose({ z: metric("z", "last"), a: metric("a", "") })

      expect(yield* score(composed, { value: 3 }, { value: 7 })).toEqual(
        new Metric.Score({ value: 4, feedback: Option.some("[a] \n[z] last") })
      )
      expect(yield* Ref.get(calls)).toEqual(Arr.make("a", "z"))
      expect(yield* score(Metric.compose({}), {}, {})).toEqual(new Metric.Score({ value: 0, feedback: Option.none() }))
    }))

  it.effect("stops at a checked scorer failure without running later children", () =>
    Effect.gen(function*() {
      class Rejected extends Data.TaggedError("Rejected") {}
      const calls = yield* Ref.make(Arr.empty<string>())
      const failure = new Rejected()
      const composed = Metric.compose({
        z: Metric.withFeedback(
          () =>
            Ref.update(calls, Arr.append("z")).pipe(Effect.as(new Metric.Score({ value: 1, feedback: Option.none() }))),
          "z"
        ),
        a: Metric.withFeedback(() => Ref.update(calls, Arr.append("a")).pipe(Effect.andThen(Effect.fail(failure))), "a")
      })

      expect(yield* Effect.result(score(composed, {}, {}))).toEqual(Result.fail(failure))
      expect(yield* Ref.get(calls)).toEqual(Arr.make("a"))
    }))

  it.effect("projects iterable named results with the final score for each repeated name", () =>
    Effect.gen(function*() {
      const results = Chunk.make(
        Tuple.make("first", new Metric.Score({ value: 0.2, feedback: Option.none() })),
        Tuple.make("second", new Metric.Score({ value: 0.7, feedback: Option.none() })),
        Tuple.make("first", new Metric.Score({ value: 0.9, feedback: Option.none() }))
      )

      expect(composedScoreMap(results)).toEqual({ first: 0.9, second: 0.7 })
    }))
})
