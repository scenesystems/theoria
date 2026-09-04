import { describe, expect, it } from "@effect/vitest"
import * as Metric from "@scenesystems/effect-dsp/Metric"
import { Effect, Option, Schema } from "effect"

import { loadFixture, MetricScoreFeedbackFixtureSchema } from "../helpers/dspy-fixtures/index.js"

type RawMetricCase =
  | {
    readonly kind: "boolean"
    readonly value: boolean
  }
  | {
    readonly kind: "number"
    readonly value: number
  }
  | {
    readonly kind: "tuple"
    readonly value: readonly [number, string]
  }

const normalizeMetricCase = (raw: RawMetricCase) => {
  if (raw.kind === "boolean") {
    return {
      score: raw.value ? 1 : 0,
      feedback: null
    }
  }

  if (raw.kind === "number") {
    return {
      score: raw.value,
      feedback: null
    }
  }

  return {
    score: raw.value[0],
    feedback: raw.value[1].trim()
  }
}

const optionalFeedback = (feedback: Option.Option<string>): Readonly<Record<string, string>> =>
  Option.match(feedback, {
    onNone: () => ({}),
    onSome: (value) => ({ feedback: value })
  })

describe("Metric.Result DSPy parity", () => {
  it.effect("normalizes score-feedback contracts from fixture cases", () =>
    Effect.gen(function*() {
      const rawFixture = yield* loadFixture("dspy.metric.score-feedback.contract")
      const fixture = yield* Schema.decodeUnknown(MetricScoreFeedbackFixtureSchema)(rawFixture)

      expect(fixture.payload.normalizationRules.length).toBeGreaterThan(0)
      yield* Effect.forEach(
        fixture.payload.cases,
        (contractCase) =>
          Effect.gen(function*() {
            const normalized = normalizeMetricCase(contractCase.raw)
            const metric = Metric.fromEffect(contractCase.name, () =>
              Effect.succeed(
                new Metric.Result({
                  score: normalized.score,
                  ...optionalFeedback(Option.fromNullable(normalized.feedback))
                })
              ))
            const scored = yield* metric.score(
              { answer: "prediction" },
              { answer: "expected" }
            )
            const decoded = yield* Schema.decodeUnknown(Metric.Result)(scored)

            expect(normalized).toStrictEqual(contractCase.normalized)
            expect(decoded.score).toBe(contractCase.normalized.score)
            expect(Option.fromNullable(decoded.feedback)).toStrictEqual(
              Option.fromNullable(contractCase.normalized.feedback)
            )
          }),
        { discard: true }
      )
    }))
})
