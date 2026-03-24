import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"

import { argmax } from "../../../src/internal/tpe/expectedImprovement.js"
import { thompsonScore } from "../../../src/samplers/Tpe/acquisition/thompson.js"

describe("tpe acquisition Thompson", () => {
  it.effect("is deterministic for identical log density and roll inputs", () =>
    Effect.sync(() => {
      const left = thompsonScore(-0.9, Option.some(0.82), Option.none())
      const right = thompsonScore(-0.9, Option.some(0.82), Option.none())

      expect(left).toBeCloseTo(right, 12)
    }))

  it.effect("uses roll-driven gumbel perturbation so higher rolls score higher at equal logL", () =>
    Effect.sync(() => {
      const lowerRoll = thompsonScore(-0.7, Option.some(0.18), Option.none())
      const higherRoll = thompsonScore(-0.7, Option.some(0.91), Option.none())

      expect(higherRoll).toBeGreaterThan(lowerRoll)
    }))

  it.effect("falls back to deterministic logL ranking when no roll is supplied", () =>
    Effect.sync(() => {
      expect(thompsonScore(-0.44, Option.none(), Option.none())).toBeCloseTo(-0.44, 12)
    }))

  it.effect("yields deterministic candidate ranking under fixed roll vectors", () =>
    Effect.sync(() => {
      const logLValues = Arr.make(-1.2, -1.2, -1.2, -1.2)
      const rolls = Arr.make(0.15, 0.77, 0.38, 0.52)
      const scores = Arr.map(logLValues, (logL, index) =>
        thompsonScore(logL, Option.fromNullable(rolls[index]), Option.none()))

      expect(argmax(scores)).toBe(1)
    }))
})
