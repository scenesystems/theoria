import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import * as Sampler from "@scenesystems/effect-search/Sampler"
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

  it.effect("calibration scoring is deterministic for the same report", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(
        defaultCalibrationProfile,
        canonicalCalibrationCases
      ).pipe(Effect.provide(calibrationServices))
      const firstScore = scoreCalibrationReportSync(report, Experimental.Calibration.DefaultCalibrationObjective)
      const secondScore = scoreCalibrationReportSync(report, Experimental.Calibration.DefaultCalibrationObjective)

      expect(firstScore).toEqual(secondScore)
    }))
})
