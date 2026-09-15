/**
 * Built-in metric contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Effect, Number, Schema } from "effect"

describe("Metric built-ins", () => {
  it.effect("exactMatch scores 1 for exact equality and 0 for mismatch", () =>
    Effect.gen(function*() {
      const exact = Metric.exactMatch("answer")

      const match = yield* exact.score(
        { answer: "Paris" },
        { answer: "Paris" }
      )
      const mismatch = yield* exact.score(
        { answer: "Lyon" },
        { answer: "Paris" }
      )

      expect(match.score).toBe(1)
      expect(mismatch.score).toBe(0)
    }))

  it.effect("f1 returns bounded overlap score for tokenized outputs", () =>
    Effect.gen(function*() {
      const f1 = Metric.f1("answer")

      const score = yield* f1.score(
        { answer: "alpha beta gamma" },
        { answer: "alpha gamma delta" }
      )

      expect(score.score).toBeCloseTo(Number.unsafeDivide(2, 3), 6)
      expect(Number.greaterThanOrEqualTo(score.score, 0)).toBe(true)
      expect(Number.lessThanOrEqualTo(score.score, 1)).toBe(true)
    }))

  it.effect("contains emits 1 for membership and 0 for absence", () =>
    Effect.gen(function*() {
      const containsParis = Metric.contains("answer", "Paris")

      const hit = yield* containsParis.score(
        { answer: "The capital is Paris." },
        { answer: "unused" }
      )
      const miss = yield* containsParis.score(
        { answer: "The capital is Tokyo." },
        { answer: "unused" }
      )

      expect(hit.score).toBe(1)
      expect(miss.score).toBe(0)
    }))

  it.effect("normalizes scalars selected from records and class instances without validating unrelated fields", () =>
    Effect.gen(function*() {
      class Answer extends Schema.Class<Answer>("MetricAnswer")({ answer: Schema.Number }) {}
      const exact = Metric.exactMatch("answer")
      expect((yield* exact.score(new Answer({ answer: 42 }), { answer: " 42 " })).score).toBe(1)
      expect((yield* exact.score({ answer: false }, { answer: " FALSE " })).score).toBe(1)
      expect((yield* exact.score({ answer: "  PARIS ", extra: Effect.void }, { answer: "paris" })).score).toBe(1)
      expect((yield* Metric.contains("answer", "  AL ").score({ answer: false }, {})).score).toBe(1)
      expect((yield* Metric.contains("answer", "").score({ answer: "" }, {})).score).toBe(1)
    }))

  it.effect("returns zero for absent and non-scalar fields even when both sides share them", () =>
    Effect.gen(function*() {
      const exact = Metric.exactMatch("answer")
      expect((yield* exact.score({}, {})).score).toBe(0)
      expect((yield* exact.score({ answer: "Paris" }, {})).score).toBe(0)
      expect((yield* exact.score({ answer: { city: "Paris" } }, { answer: { city: "Paris" } })).score).toBe(0)
      expect((yield* Metric.f1("answer").score({}, { answer: "Paris" })).score).toBe(0)
      expect((yield* Metric.contains("answer", "").score({}, {})).score).toBe(0)
    }))

  it.effect("counts duplicate tokens only up to their multiplicity on the other side", () =>
    Effect.gen(function*() {
      const f1 = Metric.f1("answer")
      const result = yield* f1.score({ answer: "red red red blue" }, { answer: "red green" })
      expect(result.score).toBeCloseTo(Number.unsafeDivide(1, 3), 12)
      const reversed = yield* f1.score({ answer: "red green" }, { answer: "red red red blue" })
      expect(reversed.score).toBeCloseTo(Number.unsafeDivide(1, 3), 12)
      expect((yield* f1.score({ answer: " \n " }, { answer: " " })).score).toBe(0)
      expect((yield* f1.score({ answer: "red" }, { answer: "blue" })).score).toBe(0)
    }))
})
