import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler } from "@scenesystems/effect-search"
import { Array as Arr, Effect, Number as Num } from "effect"

import {
  calibrationServices,
  canonicalCalibrationCases,
  defaultCalibrationProfile,
  fixedSearch
} from "../../examples/live/calibrationFixtures.js"
import * as Calibration from "../../src/Calibration.js"

const manualScore = (
  report: Calibration.Report,
  objective: Calibration.Objective
): number =>
  Numeric.sum(
    Arr.map(report.results, (result) =>
      Numeric.sum(Arr.make(
        Num.multiply(result.lineMismatchCount, objective.scoreWeights.lineMismatchCount),
        Num.multiply(Numeric.abs(result.lineCountDelta), objective.scoreWeights.lineCountError),
        Num.multiply(Numeric.abs(result.maxLineWidthDelta), objective.scoreWeights.maxLineWidthError)
      )))
  )

describe("Calibration scoring", () => {
  it.effect("effect-math-backed loss aggregation matches the released scorer on the canonical corpus", () =>
    Effect.gen(function*() {
      const optimized = yield* Calibration.optimize({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 1,
        sampler: Sampler.grid(),
        search: fixedSearch
      })

      expect(optimized.optimization.bestScore).toBe(
        manualScore(optimized.bestReport, optimized.optimization.objective)
      )
    }))

  it.effect("changed reports and objectives always produce freshly derived scores", () =>
    Effect.gen(function*() {
      const report = yield* Calibration.evaluate(
        defaultCalibrationProfile,
        canonicalCalibrationCases
      ).pipe(Effect.provide(calibrationServices))
      const changedReport: Calibration.Report = {
        ...report,
        results: Arr.map(report.results, (result) => ({
          ...result,
          lineMismatchCount: Num.increment(result.lineMismatchCount)
        }))
      }
      const changedObjective: Calibration.Objective = {
        ...Calibration.defaultObjective,
        scoreWeights: {
          ...Calibration.defaultObjective.scoreWeights,
          lineMismatchCount: 3
        }
      }
      const baseline = Calibration.score(report, Calibration.defaultObjective)
      const reportScore = Calibration.score(
        changedReport,
        Calibration.defaultObjective
      )
      const objectiveScore = Calibration.score(changedReport, changedObjective)

      expect(reportScore.total).toBe(
        Num.sum(
          baseline.total,
          Num.multiply(
            Arr.length(report.results),
            Calibration.defaultObjective.scoreWeights.lineMismatchCount
          )
        )
      )
      expect(objectiveScore.total).toBe(
        Num.sum(
          baseline.total,
          Num.multiply(Arr.length(report.results), changedObjective.scoreWeights.lineMismatchCount)
        )
      )
    }))
})
