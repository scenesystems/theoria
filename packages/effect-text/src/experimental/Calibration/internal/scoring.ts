/**
 * Internal scoring adapters for experimental calibration studies.
 *
 * `@scenesystems/effect-math` stays behind this adapter so the public experimental surface
 * exposes package-local schemas rather than foreign numeric-model types.
 *
 * @internal
 * @since 0.2.0
 */
import { Numeric, Statistics } from "@scenesystems/effect-math"
import { Array as Arr, Chunk, Effect, Number as Num } from "effect"

import type {
  CalibrationCaseLossesType,
  CalibrationCaseResultType,
  CalibrationLossSummaryType,
  CalibrationObjectiveMetadataType,
  CalibrationReportType,
  CalibrationScoreType
} from "../schema.js"

const zeroLossSummary = (): CalibrationLossSummaryType => ({
  count: 0,
  mean: 0,
  minimum: 0,
  maximum: 0,
  variance: 0,
  standardDeviation: 0
})

const calibrationLossSummaryFromStatistics = (
  summary: Statistics.SummaryStatistics
): CalibrationLossSummaryType => ({
  count: summary.count,
  mean: summary.mean,
  minimum: summary.min,
  maximum: summary.max,
  variance: summary.variance,
  standardDeviation: summary.standardDeviation
})

/**
 * Score one calibration case with the explicit objective weights.
 *
 * @since 0.2.0
 * @category internals
 */
export const scoreCaseResult = (
  result: CalibrationCaseResultType,
  objective: CalibrationObjectiveMetadataType
) =>
  Num.sum(
    Num.sum(
      Num.multiply(result.lineMismatchCount, objective.scoreWeights.lineMismatchCount),
      Num.multiply(Numeric.abs(result.lineCountDelta), objective.scoreWeights.lineCountError)
    ),
    Num.multiply(Numeric.abs(result.maxLineWidthDelta), objective.scoreWeights.maxLineWidthError)
  )

/**
 * Summarize per-case losses through `@scenesystems/effect-math` statistics kernels.
 *
 * @since 0.2.0
 * @category internals
 */
export const summarizeCaseLosses = (
  caseLosses: CalibrationCaseLossesType
) => Effect.succeed(summarizeCaseLossesSync(caseLosses))

const summarizeCaseLossesSync = (caseLosses: CalibrationCaseLossesType): CalibrationLossSummaryType =>
  Arr.match(caseLosses, {
    onEmpty: zeroLossSummary,
    onNonEmpty: (losses) => calibrationLossSummaryFromStatistics(Statistics.summaryStatistics(Chunk.make(...losses)))
  })

/**
 * Pure scoring kernel for experimental calibration reports.
 *
 * @since 0.2.0
 * @category internals
 */
const computeCalibrationReportScore = (
  report: CalibrationReportType,
  objective: CalibrationObjectiveMetadataType
): CalibrationScoreType => {
  const caseLosses = Arr.map(report.results, (result) => scoreCaseResult(result, objective))

  return Arr.match(caseLosses, {
    onEmpty: () => ({
      caseLosses: Arr.empty(),
      summary: zeroLossSummary(),
      total: 0
    }),
    onNonEmpty: (losses) => ({
      caseLosses: losses,
      summary: summarizeCaseLossesSync(losses),
      total: Numeric.sum(losses)
    })
  })
}

/**
 * Pure scoring kernel for experimental calibration reports.
 *
 * @since 0.2.0
 * @category internals
 */
export const scoreCalibrationReportSync = (
  report: CalibrationReportType,
  objective: CalibrationObjectiveMetadataType
): CalibrationScoreType => computeCalibrationReportScore(report, objective)

/**
 * Collapse one calibration report into a scalar optimization score plus a
 * loss summary over its per-case penalties.
 *
 * @since 0.2.0
 * @category internals
 */
export const scoreCalibrationReport = (
  report: CalibrationReportType,
  objective: CalibrationObjectiveMetadataType
) => Effect.succeed(scoreCalibrationReportSync(report, objective))
