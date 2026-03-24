import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import fc from "fast-check"

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
      const scores = [-2.2, 0.4, 1.9, 1.2]
      expect(argmax(scores)).toBe(2)
    }))

  it.effect("never emits NaN scores for finite inputs", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          fc.integer({ min: -1_000_000, max: 1_000_000 }),
          fc.integer({ min: -1_000_000, max: 1_000_000 }),
          (logL, logG) => {
            expect(Number.isNaN(expectedImprovementScore(logL, logG))).toBe(false)
          }
        )
      )
    }))

  it.effect("accumulates joint log-density contributions for grouped EI", () =>
    Effect.sync(() => {
      expect(sumLogDensities([-1.2, -0.3, -2.5])).toBeCloseTo(-4, 12)
      expect(jointExpectedImprovementScore([-1.2, -0.3], [-2.1, -1.1])).toBeCloseTo(1.7, 12)
    }))

  it.effect("always chooses an index inside the provided candidate set", () =>
    Effect.sync(() => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: -1_000_000, max: 1_000_000 }), { minLength: 1, maxLength: 100 }),
          (scores) => {
            const index = argmax(scores)
            expect(index).toBeGreaterThanOrEqual(0)
            expect(index).toBeLessThan(scores.length)

            const baseline = scores[0] ?? Number.NEGATIVE_INFINITY
            const maximum = scores.reduce((best, value) => (value > best ? value : best), baseline)
            expect(scores[index]).toBe(maximum)
          }
        )
      )
    }))
})
