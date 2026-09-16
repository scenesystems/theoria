/**
 * Metric composition contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Array as Arr, Chunk, Data, Effect, Either, Number, Ref, Schema, Tuple } from "effect"

describe("Metric.compose", () => {
  it.effect("aggregates child metrics into a deterministic score", () =>
    Effect.gen(function*() {
      const accuracy = Metric.exactMatch("answer")
      const mentionsParis = Metric.contains("answer", "Paris")
      const composed = Metric.compose({ accuracy, mentionsParis })

      const result = yield* composed.score(
        { answer: "The capital is Paris." },
        { answer: "Paris" }
      )

      expect(result.score).toBe(0.5)
    }))

  it.effect("returns stable outputs for identical inputs", () =>
    Effect.gen(function*() {
      const composed = Metric.compose({
        exact: Metric.exactMatch("answer"),
        f1: Metric.f1("answer")
      })

      const first = yield* composed.score(
        { answer: "alpha beta" },
        { answer: "alpha gamma" }
      )
      const second = yield* composed.score(
        { answer: "alpha beta" },
        { answer: "alpha gamma" }
      )

      expect(first).toEqual(second)
    }))

  it.effect("orders schema-bound scorers and feedback by name, including empty feedback", () =>
    Effect.gen(function*() {
      const Output = Schema.Struct({ value: Schema.Number })
      const calls = yield* Ref.make(Arr.empty<string>())
      const metric = (name: string, feedback: string) =>
        Metric.fromEffect(name, (prediction: typeof Output.Type, expected) =>
          Ref.update(calls, Arr.append(name)).pipe(
            Effect.as(new Metric.Result({ score: Number.subtract(prediction.value, expected.value), feedback }))
          ))
      const composed = Metric.compose({ z: metric("z", "last"), a: metric("a", "") })

      expect(yield* composed.score({ value: 7 }, { value: 3 })).toEqual(
        new Metric.Result({ score: 4, feedback: "[a] \n[z] last" })
      )
      expect(yield* Ref.get(calls)).toEqual(Arr.make("a", "z"))
      expect(yield* Metric.compose({}).score({}, {})).toEqual(new Metric.Result({ score: 0 }))
    }))

  it.effect("stops at a checked scorer failure without running later children", () =>
    Effect.gen(function*() {
      class Rejected extends Data.TaggedError("Rejected") {}
      const calls = yield* Ref.make(Arr.empty<string>())
      const failure = new Rejected()
      const composed = Metric.compose({
        z: Metric.fromEffect("z", () =>
          Ref.update(calls, Arr.append("z")).pipe(Effect.as(new Metric.Result({ score: 1 })))),
        a: Metric.fromEffect("a", () =>
          Ref.update(calls, Arr.append("a")).pipe(Effect.zipRight(Effect.fail(failure))))
      })

      expect(yield* Effect.either(composed.score({}, {}))).toEqual(Either.left(failure))
      expect(yield* Ref.get(calls)).toEqual(Arr.make("a"))
    }))

  it.effect("projects iterable named results with the final score for each repeated name", () =>
    Effect.gen(function*() {
      const results = Chunk.make(
        Tuple.make("first", new Metric.Result({ score: 0.2 })),
        Tuple.make("second", new Metric.Result({ score: 0.7 })),
        Tuple.make("first", new Metric.Result({ score: 0.9 }))
      )
      expect(Metric.composedScoreMap(results)).toEqual({ first: 0.9, second: 0.7 })
    }))
})
