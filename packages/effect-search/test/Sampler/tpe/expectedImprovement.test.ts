import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Equal, FastCheck as fc, Number as Num, Schema } from "effect"

import {
  argmax,
  expectedImprovementScore,
  jointExpectedImprovementScore,
  sumLogDensities
} from "../../../src/internal/tpe/expectedImprovement.js"

describe("tpe expected improvement", () => {
  it.effect("computes EI scores as log_l minus log_g", () =>
    Effect.sync(() => {
      expect(expectedImprovementScore(-1.75, -3.1)).toBeCloseTo(1.35, 12)
      expect(expectedImprovementScore(-3.1, -1.75)).toBeCloseTo(-1.35, 12)
    }))

  it.effect("selects the candidate with maximal EI score", () =>
    Effect.sync(() => {
      const scores = Arr.make(-2.2, 0.4, 1.9, 1.2)
      expect(argmax(scores)).toBe(2)
    }))

  it.effect("does not replace an ordered incumbent with NaN", () =>
    Effect.sync(() => {
      expect(argmax(Arr.make(3, NaN, 1))).toBe(0)
      expect(argmax(Arr.make(NaN, 3, 1))).toBe(1)
      expect(argmax(Arr.make(NaN, NaN))).toBe(0)
    }))

  it.effect("selects the first ordered candidate even at negative infinity", () =>
    Effect.sync(() => {
      expect(argmax(Arr.make(NaN, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY))).toBe(1)
      expect(argmax(Arr.make(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY))).toBe(0)
      expect(argmax(Arr.make(NaN, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY))).toBe(1)
    }))

  it.effect.prop("never emits NaN scores for finite inputs", {
    logL: fc.integer({ min: -1_000_000, max: 1_000_000 }),
    logG: fc.integer({ min: -1_000_000, max: 1_000_000 })
  }, ({ logL, logG }) =>
    Effect.sync(() => {
      expect(Schema.is(Schema.NonNaN)(expectedImprovementScore(logL, logG))).toBe(true)
    }))
  it.effect("accumulates joint log-density contributions for grouped EI", () =>
    Effect.sync(() => {
      expect(sumLogDensities(Arr.make(-1.2, -0.3, -2.5))).toBeCloseTo(-4, 12)
      expect(jointExpectedImprovementScore(Arr.make(-1.2, -0.3), Arr.make(-2.1, -1.1))).toBeCloseTo(1.7, 12)
    }))

  it.effect.prop("selects the first maximum in the provided candidate set", {
    scores: fc.array(fc.integer({ min: -1_000_000, max: 1_000_000 }), { minLength: 1, maxLength: 100 })
  }, ({ scores }) =>
    Effect.gen(function*() {
      const index = argmax(scores)
      const selected = yield* Arr.get(scores, index)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(Arr.length(scores))
      expect(Arr.every(scores, Num.lessThanOrEqualTo(selected))).toBe(true)
      expect(yield* Arr.findFirstIndex(scores, Equal.equals(selected))).toBe(index)
    }))
})
