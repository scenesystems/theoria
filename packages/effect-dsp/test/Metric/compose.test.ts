/**
 * Metric composition contracts.
 */
import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import * as Metric from "effect-dsp/Metric"

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
})
