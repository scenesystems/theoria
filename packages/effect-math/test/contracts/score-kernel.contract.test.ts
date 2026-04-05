import { describe, expect, it } from "@effect/vitest"
import { Chunk, Effect } from "effect"

import { lossSummary, normalizeBeneficial, normalizeInverseBudget, weightedMean } from "../../src/Statistics/score.js"

describe("score kernel contracts", () => {
  it.effect("aggregates weighted component values deterministically", () =>
    Effect.gen(function*() {
      const result = weightedMean(Chunk.make(0.9, 0.6, 0.3), Chunk.make(2, 1, 1))

      expect(result).toBeCloseTo(0.675)
    }))

  it.effect("normalizes beneficial metrics into the closed unit interval", () =>
    Effect.gen(function*() {
      expect(normalizeBeneficial(10, { minimum: 20, maximum: 40 })).toStrictEqual(0)
      expect(normalizeBeneficial(30, { minimum: 20, maximum: 40 })).toStrictEqual(0.5)
      expect(normalizeBeneficial(50, { minimum: 20, maximum: 40 })).toStrictEqual(1)
    }))

  it.effect("normalizes budgeted cost metrics as inverse budget utilization", () =>
    Effect.gen(function*() {
      expect(normalizeInverseBudget(0, { budget: 100 })).toStrictEqual(1)
      expect(normalizeInverseBudget(50, { budget: 100 })).toStrictEqual(0.5)
      expect(normalizeInverseBudget(150, { budget: 100 })).toStrictEqual(0)
    }))

  it.effect("projects normalized losses through the canonical summary-statistics carrier", () =>
    Effect.gen(function*() {
      const result = lossSummary(Chunk.make(0.1, 0.2, 0.5))

      expect(result._tag).toStrictEqual("SummaryStatistics")
      expect(result.count).toStrictEqual(3)
      expect(result.min).toStrictEqual(0.1)
      expect(result.max).toStrictEqual(0.5)
      expect(result.mean).toBeCloseTo(0.2666666667)
      expect(result.variance).toBeCloseTo(0.0433333333)
    }))
})
