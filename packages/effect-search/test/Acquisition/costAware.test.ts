import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Chunk, Effect, Number as Num, Option } from "effect"

import { DimensionScoreTrace } from "../../src/internal/tpe/dimensions/trace.js"
import {
  costWeightedExpectedImprovementScore,
  expectedImprovementScore
} from "../../src/internal/tpe/expectedImprovement.js"
import { NamedDimensionScoreTrace, selectBestMixedCandidate } from "../../src/internal/tpe/mixed.js"
import { CompletedTrialForSplit } from "../../src/internal/tpe/splitTrials.js"

describe("tpe cost-aware acquisition", () => {
  it.effect("applies EI / estimated_cost weighting in log-space scoring", () =>
    Effect.sync(() => {
      const logL = Num.negate(0.2)
      const logG = Num.negate(0.8)

      const baseline = expectedImprovementScore(logL, logG)
      const cheap = costWeightedExpectedImprovementScore(logL, logG, Option.some(1))
      const expensive = costWeightedExpectedImprovementScore(logL, logG, Option.some(20))

      expect(cheap).toBeCloseTo(baseline, 12)
      expect(expensive).toBeLessThan(cheap)
    }))

  it.effect("selects lower estimated cost candidates when EI scores tie", () =>
    Effect.gen(function*() {
      const traces = Arr.of(
        new NamedDimensionScoreTrace({
          name: "x",
          trace: new DimensionScoreTrace({
            candidates: Chunk.make({ x: 0.1 }, { x: 0.9 }),
            logL: Arr.make(Num.negate(0.2), Num.negate(0.2)),
            logG: Arr.make(Num.negate(0.7), Num.negate(0.7)),
            scores: Arr.make(0.5, 0.5)
          })
        })
      )

      const split = {
        below: Arr.make(
          new CompletedTrialForSplit({ trialNumber: 0, config: { x: 0.1 }, value: 0.1, cost: 12 }),
          new CompletedTrialForSplit({ trialNumber: 1, config: { x: 0.9 }, value: 0.2, cost: 1 })
        ),
        above: Arr.empty<CompletedTrialForSplit>()
      }

      const selection = yield* selectBestMixedCandidate(traces, split)

      expect(selection.bestIndex).toBe(1)
      expect(selection.bestConfig).toEqual({ x: 0.9 })
    }))
})
