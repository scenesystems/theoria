import { describe, expect, it } from "@effect/vitest"
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Sampler } from "@scenesystems/effect-search"
import { Effect } from "effect"

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
    report.results.map((result) =>
      Numeric.sum([
        result.lineMismatchCount * objective.scoreWeights.lineMismatchCount,
        Numeric.abs(result.lineCountDelta) * objective.scoreWeights.lineCountError,
        Numeric.abs(result.maxLineWidthDelta) * objective.scoreWeights.maxLineWidthError
      ])
    )
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

  it.effect("calibration scoring stays cache-backed without mutating public report objects", () =>
    Effect.gen(function*() {
      const report = yield* Experimental.Calibration.evaluateProfile(
        defaultCalibrationProfile,
        canonicalCalibrationCases
      ).pipe(Effect.provide(calibrationServices))
      const firstScore = scoreCalibrationReportSync(report, Experimental.Calibration.DefaultCalibrationObjective)
      const secondScore = scoreCalibrationReportSync(report, Experimental.Calibration.DefaultCalibrationObjective)

      expect(firstScore).toEqual(secondScore)
      expect(Object.getOwnPropertySymbols(report)).toEqual([])
    }))
})
