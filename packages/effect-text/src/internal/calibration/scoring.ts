/**
 * Weighted calibration scoring and descriptive loss statistics.
 *
 * @internal
 * @since 0.5.0
 */
import { Numeric, Statistics } from "@scenesystems/effect-math"
import { Chunk, Number as Num } from "effect"
import * as Arr from "effect/Array"

import type * as Calibration from "../../Calibration.js"

const zeroLossSummary = (): Calibration.LossSummary => ({
  count: 0,
  mean: 0,
  minimum: 0,
  maximum: 0,
  variance: 0,
  standardDeviation: 0
})

const lossSummaryFromStatistics = (
  summary: Statistics.SummaryStatistics
): Calibration.LossSummary => ({
  count: summary.count,
  mean: summary.mean,
  minimum: summary.min,
  maximum: summary.max,
  variance: summary.variance,
  standardDeviation: summary.standardDeviation
})

const scoreCaseResult = (
  result: Calibration.CaseResult,
  objective: Calibration.Objective
): number =>
  Num.sum(
    Num.sum(
      Num.multiply(result.lineMismatchCount, objective.scoreWeights.lineMismatchCount),
      Num.multiply(Numeric.abs(result.lineCountDelta), objective.scoreWeights.lineCountError)
    ),
    Num.multiply(Numeric.abs(result.maxLineWidthDelta), objective.scoreWeights.maxLineWidthError)
  )

const summarizeCaseLosses = (caseLosses: Calibration.CaseLosses): Calibration.LossSummary =>
  Arr.match(caseLosses, {
    onEmpty: zeroLossSummary,
    onNonEmpty: (losses) =>
      lossSummaryFromStatistics(Statistics.summaryStatistics(Chunk.unsafeFromNonEmptyArray(losses)))
  })

/** @internal */
export const scoreReport = (
  report: Calibration.Report,
  objective: Calibration.Objective
): Calibration.Score => {
  const caseLosses = Arr.map(report.results, (result) => scoreCaseResult(result, objective))

  return Arr.match(caseLosses, {
    onEmpty: () => ({
      caseLosses: Arr.empty(),
      summary: zeroLossSummary(),
      total: 0
    }),
    onNonEmpty: (losses) => ({
      caseLosses: losses,
      summary: summarizeCaseLosses(losses),
      total: Numeric.sum(losses)
    })
  })
}
