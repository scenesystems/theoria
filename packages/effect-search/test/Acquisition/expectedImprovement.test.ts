import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, FastCheck as fc, Number as Num, Option, Schema, Tuple } from "effect"

import {
  argmax,
  expectedImprovementScore,
  jointExpectedImprovementScore,
  sumLogDensities
} from "../../src/internal/tpe/expectedImprovement.js"

describe("tpe expected improvement", () => {
  it.effect("computes EI scores as log_l minus log_g", () =>
    Effect.sync(() => {
      expect(expectedImprovementScore(Num.negate(1.75), Num.negate(3.1))).toBeCloseTo(1.35, 12)
      expect(expectedImprovementScore(Num.negate(3.1), Num.negate(1.75))).toBeCloseTo(Num.negate(1.35), 12)
    }))

  it.effect("selects the candidate with maximal EI score", () =>
    Effect.sync(() => {
      const scores = Arr.make(Num.negate(2.2), 0.4, 1.9, 1.2)
      expect(argmax(scores)).toBe(2)
    }))

  it.effect.prop(
    "never emits NaN scores for finite inputs",
    Tuple.make(
      fc.integer({ min: Num.negate(1_000_000), max: 1_000_000 }),
      fc.integer({ min: Num.negate(1_000_000), max: 1_000_000 })
    ),
    ([logL, logG]) =>
      Effect.sync(() => {
        expect(Schema.is(Schema.NonNaN)(expectedImprovementScore(logL, logG))).toBe(true)
      })
  )

  it.effect("accumulates joint log-density contributions for grouped EI", () =>
    Effect.sync(() => {
      expect(sumLogDensities(Arr.make(Num.negate(1.2), Num.negate(0.3), Num.negate(2.5)))).toBeCloseTo(
        Num.negate(4),
        12
      )
      expect(
        jointExpectedImprovementScore(
          Arr.make(Num.negate(1.2), Num.negate(0.3)),
          Arr.make(Num.negate(2.1), Num.negate(1.1))
        )
      ).toBeCloseTo(1.7, 12)
    }))

  it.effect.prop(
    "always chooses an index inside the provided candidate set",
    Tuple.make(
      fc.array(fc.integer({ min: Num.negate(1_000_000), max: 1_000_000 }), { minLength: 1, maxLength: 100 })
    ),
    ([scores]) =>
      Effect.sync(() => {
        const index = argmax(scores)
        expect(index).toBeGreaterThanOrEqual(0)
        expect(index).toBeLessThan(Arr.length(scores))

        const baseline = Arr.head(scores).pipe(Option.getOrElse(() => Number.NEGATIVE_INFINITY))
        const maximum = Arr.reduce(scores, baseline, Num.max)
        expect(Arr.get(scores, index).pipe(Option.getOrElse(() => Number.NEGATIVE_INFINITY))).toBe(maximum)
      })
  )
})
