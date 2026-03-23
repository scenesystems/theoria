/**
 * Built-in metric contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Metric from "effect-dsp/Metric"

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

      expect(score.score).toBeCloseTo(2 / 3, 6)
      expect(score.score >= 0).toBe(true)
      expect(score.score <= 1).toBe(true)
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
})
