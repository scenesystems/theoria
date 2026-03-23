import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"

import {
  costWeightedExpectedImprovementScore,
  expectedImprovementScore
} from "../../../src/internal/tpe/expectedImprovement.js"
import { CompletedTrialForSplit } from "../../../src/internal/tpe/splitTrials.js"
import { DimensionScoreTrace } from "../../../src/samplers/Tpe/dimensions/trace.js"
import { NamedDimensionScoreTrace, selectBestMixedCandidate } from "../../../src/samplers/Tpe/mixed.js"

describe("tpe cost-aware acquisition", () => {
  it.effect("applies EI / estimated_cost weighting in log-space scoring", () =>
    Effect.sync(() => {
      const logL = -0.2
      const logG = -0.8

      const baseline = expectedImprovementScore(logL, logG)
      const cheap = costWeightedExpectedImprovementScore(logL, logG, Option.some(1))
      const expensive = costWeightedExpectedImprovementScore(logL, logG, Option.some(20))

      expect(cheap).toBeCloseTo(baseline, 12)
      expect(expensive).toBeLessThan(cheap)
    }))

  it.effect("selects lower estimated cost candidates when EI scores tie", () =>
    Effect.gen(function*() {
      const traces = [
        new NamedDimensionScoreTrace({
          name: "x",
          trace: new DimensionScoreTrace({
            candidates: [{ x: 0.1 }, { x: 0.9 }],
            logL: [-0.2, -0.2],
            logG: [-0.7, -0.7],
            scores: [0.5, 0.5]
          })
        })
      ]

      const split = {
        below: [
          new CompletedTrialForSplit({ trialNumber: 0, config: { x: 0.1 }, value: 0.1, cost: 12 }),
          new CompletedTrialForSplit({ trialNumber: 1, config: { x: 0.9 }, value: 0.2, cost: 1 })
        ],
        above: []
      }

      const selection = yield* selectBestMixedCandidate(traces, split)

      expect(selection.bestIndex).toBe(1)
      expect(selection.bestConfig).toEqual({ x: 0.9 })
    }))
})
