import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Effect, Schema } from "effect"
import { score } from "../kit/Metric.js"

describe("Metric built-ins", () => {
  it.effect("requires a reference for exact matching and preserves Python whitespace normalization", () =>
    Effect.gen(function*() {
      const failure = yield* score(Metric.answerExactMatch(), { answer: [] }, { answer: "York" }).pipe(Effect.flip)
      expect(failure).toBeInstanceOf(Schema.SchemaError)
      expect((yield* score(Metric.answerExactMatch(), { answer: "new york" }, { answer: "New\u001cYork" })).value).toBe(
        1
      )
      expect((yield* score(Metric.answerPassageMatch(), { answer: [] }, { context: ["York"] })).value).toBe(0)
    }))

  it.effect("compares normalized scalar fields independently of unrelated fields", () =>
    Effect.gen(function*() {
      class Answer extends Schema.Class<Answer>("MetricAnswer")({ answer: Schema.Finite }) {}
      const exact = Metric.exactMatch("answer")
      expect((yield* score(exact, { answer: "Paris" }, { answer: "Paris" })).value).toBe(1)
      expect((yield* score(exact, { answer: "Paris" }, { answer: "Lyon" })).value).toBe(0)
      expect((yield* score(exact, { answer: " 42 " }, new Answer({ answer: 42 }))).value).toBe(1)
      expect((yield* score(exact, { answer: " FALSE " }, { answer: false })).value).toBe(1)
      expect((yield* score(exact, { answer: "paris" }, { answer: "  PARIS ", extra: Effect.void })).value).toBe(1)
    }))

  it.effect("returns zero for absent or non-scalar fields", () =>
    Effect.gen(function*() {
      const exact = Metric.exactMatch("answer")
      expect((yield* score(exact, {}, {})).value).toBe(0)
      expect((yield* score(exact, {}, { answer: "Paris" })).value).toBe(0)
      expect((yield* score(exact, { answer: { city: "Paris" } }, { answer: { city: "Paris" } })).value).toBe(0)
      expect((yield* score(Metric.f1("answer"), { answer: "Paris" }, {})).value).toBe(0)
      expect((yield* score(Metric.contains("answer", ""), {}, {})).value).toBe(0)
    }))

  it.effect("contains normalizes its target and matches empty targets only against scalar fields", () =>
    Effect.gen(function*() {
      const contains = Metric.contains("answer", "Paris")
      expect((yield* score(contains, {}, { answer: "The capital is Paris." })).value).toBe(1)
      expect((yield* score(contains, {}, { answer: "The capital is Tokyo." })).value).toBe(0)
      expect((yield* score(Metric.contains("answer", "  AL "), {}, { answer: false })).value).toBe(1)
      expect((yield* score(Metric.contains("answer", ""), {}, { answer: "" })).value).toBe(1)
    }))

  it.effect("computes multiset token F1 including asymmetric duplicate counts and empty values", () =>
    Effect.gen(function*() {
      const f1 = Metric.f1("answer")
      expect((yield* score(f1, { answer: "alpha gamma delta" }, { answer: "alpha beta gamma" })).value).toBeCloseTo(
        2 / 3,
        12
      )
      expect((yield* score(f1, { answer: "red green" }, { answer: "red red red blue" })).value).toBeCloseTo(1 / 3, 12)
      expect((yield* score(f1, { answer: "red red red blue" }, { answer: "red green" })).value).toBeCloseTo(1 / 3, 12)
      expect((yield* score(f1, { answer: " " }, { answer: " \n " })).value).toBe(0)
      expect((yield* score(f1, { answer: "blue" }, { answer: "red" })).value).toBe(0)
    }))
})
