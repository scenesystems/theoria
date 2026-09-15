import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler } from "@scenesystems/effect-search"
import { Array as Arr, Effect, Number as Num } from "effect"

import { scoreCalibrationReportSync } from "../../src/experimental/Calibration/internal/scoring.js"
import { Experimental } from "../../src/index.js"
import {
  calibrationServices,
  canonicalCalibrationCases,
  defaultCalibrationProfile,
  defaultSearchDescriptor
} from "./fixtures.js"

const manualScore = (
  report: Experimental.Calibration.CalibrationReportType,
  objective: Experimental.Calibration.CalibrationObjectiveMetadataType
): number =>
  Numeric.sum(
    Arr.map(report.results, (result) =>
      Numeric.sum(Arr.make(
        Num.multiply(result.lineMismatchCount, objective.scoreWeights.lineMismatchCount),
        Num.multiply(Numeric.abs(result.lineCountDelta), objective.scoreWeights.lineCountError),
        Num.multiply(Numeric.abs(result.maxLineWidthDelta), objective.scoreWeights.maxLineWidthError)
      )))
  )

describe("Experimental.Calibration effect-math integration contracts", () => {
  it.effect("effect-math-backed loss aggregation matches the released scorer on the canonical corpus", () =>
    Effect.gen(function*() {
      const optimized = yield* Experimental.Calibration.optimizeProfile({
        cases: canonicalCalibrationCases,
        services: calibrationServices,
        trials: 1,
        sampler: Sampler.grid(),
        searchDescriptor: defaultSearchDescriptor
      })

      expect(optimized.optimization.bestScore).toBe(
        manualScore(optimized.bestReport, optimized.optimization.objective)
      )
    }))

  it.effect("changed reports and objectives always produce freshly derived scores", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(
        defaultCalibrationProfile,
        canonicalCalibrationCases
      ).pipe(Effect.provide(calibrationServices))
      const changedReport: Experimental.Calibration.CalibrationReportType = {
        ...report,
        results: Arr.map(report.results, (result) => ({
          ...result,
          lineMismatchCount: Num.increment(result.lineMismatchCount)
        }))
      }
      const changedObjective: Experimental.Calibration.CalibrationObjectiveMetadataType = {
        ...Experimental.Calibration.DefaultCalibrationObjective,
        scoreWeights: {
          ...Experimental.Calibration.DefaultCalibrationObjective.scoreWeights,
          lineMismatchCount: 3
        }
      }
      const baseline = scoreCalibrationReportSync(report, Experimental.Calibration.DefaultCalibrationObjective)
      const reportScore = scoreCalibrationReportSync(
        changedReport,
        Experimental.Calibration.DefaultCalibrationObjective
      )
      const objectiveScore = scoreCalibrationReportSync(changedReport, changedObjective)

      expect(reportScore.total).toBe(
        Num.sum(
          baseline.total,
          Num.multiply(
            Arr.length(report.results),
            Experimental.Calibration.DefaultCalibrationObjective.scoreWeights.lineMismatchCount
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
