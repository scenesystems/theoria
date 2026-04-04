/**
 * Internal scoring adapters for experimental calibration studies.
 *
 * `effect-math` stays behind this adapter so the public experimental surface
 * exposes package-local schemas rather than foreign numeric-model types.
 *
 * @internal
 * @since 0.2.0
 */
import { Chunk, Effect, HashMap, Number as Num, Option } from "effect"
import { Statistics } from "effect-math"
import * as MutableRef from "effect/MutableRef"

import type {
  CalibrationCaseResultType,
  CalibrationLossSummaryType,
  CalibrationObjectiveMetadataType,
  CalibrationReportType
} from "../schema.js"

const scoreCache = MutableRef.make(
  HashMap.empty<
    CalibrationReportType,
    HashMap.HashMap<
      CalibrationObjectiveMetadataType,
      {
        readonly caseLosses: ReadonlyArray<number>
        readonly summary: CalibrationLossSummaryType
        readonly total: number
      }
    >
  >()
)

const absoluteValue = (value: number): number => Num.lessThan(value, 0) ? Num.negate(value) : value

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
      Num.multiply(absoluteValue(result.lineCountDelta), objective.scoreWeights.lineCountError)
    ),
    Num.multiply(absoluteValue(result.maxLineWidthDelta), objective.scoreWeights.maxLineWidthError)
  )

/**
 * Summarize per-case losses through `effect-math` statistics kernels.
 *
 * @since 0.2.0
 * @category internals
 */
export const summarizeCaseLosses = (
  caseLosses: ReadonlyArray<number>
) => Effect.succeed(summarizeCaseLossesSync(caseLosses))

const totalFromSummary = (summary: CalibrationLossSummaryType): number => Num.multiply(summary.mean, summary.count)

const getCachedScore = (
  report: CalibrationReportType,
  objective: CalibrationObjectiveMetadataType
): Option.Option<{
  readonly caseLosses: ReadonlyArray<number>
  readonly summary: CalibrationLossSummaryType
  readonly total: number
}> =>
  HashMap.get(MutableRef.get(scoreCache), report).pipe(
    Option.flatMap((reportCache) => HashMap.get(reportCache, objective))
  )

const setCachedScore = (
  report: CalibrationReportType,
  objective: CalibrationObjectiveMetadataType,
  score: {
    readonly caseLosses: ReadonlyArray<number>
    readonly summary: CalibrationLossSummaryType
    readonly total: number
  }
) => {
  MutableRef.update(scoreCache, (cache) => {
    const reportCache = HashMap.get(cache, report).pipe(Option.getOrElse(() => HashMap.empty()))

    return HashMap.set(cache, report, HashMap.set(reportCache, objective, score))
  })

  return score
}

const summarizeCaseLossesSync = (caseLosses: ReadonlyArray<number>): CalibrationLossSummaryType => {
  if (caseLosses.length <= 0) {
    return zeroLossSummary()
  }

  const caseLossesChunk = Chunk.unsafeFromArray(caseLosses)

  if (!Chunk.isNonEmpty(caseLossesChunk)) {
    return zeroLossSummary()
  }

  return calibrationLossSummaryFromStatistics(Statistics.summaryStatistics(caseLossesChunk))
}

/**
 * Pure scoring kernel for experimental calibration reports.
 *
 * @since 0.2.0
 * @category internals
 */
const computeCalibrationReportScore = (
  report: CalibrationReportType,
  objective: CalibrationObjectiveMetadataType
): {
  readonly caseLosses: ReadonlyArray<number>
  readonly summary: CalibrationLossSummaryType
  readonly total: number
} => {
  if (report.results.length <= 0) {
    return {
      caseLosses: [],
      summary: zeroLossSummary(),
      total: 0
    }
  }

  const caseLosses = report.results.map((result) => scoreCaseResult(result, objective))
  const summary = summarizeCaseLossesSync(caseLosses)

  return {
    caseLosses,
    summary,
    total: totalFromSummary(summary)
  }
}

export const scoreCalibrationReportSync = (
  report: CalibrationReportType,
  objective: CalibrationObjectiveMetadataType
) => {
  const cached = getCachedScore(report, objective)

  return Option.getOrElse(
    cached,
    () => setCachedScore(report, objective, computeCalibrationReportScore(report, objective))
  )
}

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
