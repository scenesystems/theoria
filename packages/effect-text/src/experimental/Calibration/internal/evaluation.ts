/**
 * Comparison of expected line geometry with actual prepared-layout output.
 *
 * @internal
 * @since 0.1.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Number as Num, Option, Schema } from "effect"

import type { LayoutLineType, LayoutSummaryType } from "../../../Text/schema.js"
import {
  type CalibrationCaseResultType,
  type CalibrationCaseType,
  type CalibrationProfileType,
  type CalibrationReportType,
  CalibrationTargetLine,
  type CalibrationTargetLineType,
  type CalibrationTargetType
} from "../schema.js"

const equivalentTargetLine = Schema.equivalence(CalibrationTargetLine)

const matchesSummary = (expected: CalibrationTargetType, actual: LayoutSummaryType): boolean =>
  Bool.and(
    Num.Equivalence(expected.lineCount, actual.lineCount),
    Num.Equivalence(expected.maxLineWidth, actual.maxLineWidth)
  )

const matchesLine = (
  expected: Option.Option<CalibrationTargetLineType>,
  actual: Option.Option<LayoutLineType>
): boolean =>
  Option.all({ expected, actual }).pipe(
    Option.match({
      onNone: () => false,
      onSome: ({ expected: expectedLine, actual: actualLine }) =>
        equivalentTargetLine(expectedLine, {
          text: actualLine.text,
          width: actualLine.width
        })
    })
  )

const lineMismatchCount = (
  expected: CalibrationTargetType["lines"],
  actual: CalibrationCaseResultType["actualLines"]
): number =>
  Option.fromNullable(expected).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (expectedLines) =>
        Arr.reduce(
          Arr.makeBy(Num.max(Arr.length(expectedLines), Arr.length(actual)), (index) => index),
          0,
          (mismatchCount, index) =>
            Num.sum(
              mismatchCount,
              Bool.match(matchesLine(Arr.get(expectedLines, index), Arr.get(actual, index)), {
                onFalse: () => 1,
                onTrue: () => 0
              })
            )
        )
    })
  )

/**
 * Builds one case result by comparing expected calibration targets against actual layout output.
 *
 * @since 0.1.0
 * @category internals
 */
export const makeCaseResult = (
  calibrationCase: CalibrationCaseType,
  actual: LayoutSummaryType,
  actualLines: CalibrationCaseResultType["actualLines"]
): CalibrationCaseResultType => {
  const mismatchCount = lineMismatchCount(calibrationCase.expected.lines, actualLines)
  const lineCountDelta = Num.subtract(actual.lineCount, calibrationCase.expected.lineCount)
  const maxLineWidthDelta = Num.subtract(actual.maxLineWidth, calibrationCase.expected.maxLineWidth)

  return {
    name: calibrationCase.name,
    expected: calibrationCase.expected,
    actual,
    actualLines,
    lineCountDelta,
    maxLineWidthDelta,
    lineMismatchCount: mismatchCount,
    matched: Bool.and(
      matchesSummary(calibrationCase.expected, actual),
      Num.Equivalence(mismatchCount, 0)
    )
  }
}

/**
 * Creates an empty report accumulator for one experimental calibration profile.
 *
 * @since 0.1.0
 * @category internals
 */
export const emptyReport = (profile: CalibrationProfileType): CalibrationReportType => ({
  profile,
  caseCount: 0,
  matchedCaseCount: 0,
  totalLineCountError: 0,
  totalMaxLineWidthError: 0,
  totalLineMismatchCount: 0,
  results: Arr.empty()
})

/**
 * Reduces per-case calibration results into the released aggregate report shape.
 *
 * @since 0.2.0
 * @category internals
 */
export const summarizeReport = (
  profile: CalibrationProfileType,
  results: CalibrationReportType["results"]
): CalibrationReportType =>
  Arr.reduce(
    results,
    emptyReport(profile),
    (report, result) => ({
      profile: report.profile,
      caseCount: Num.increment(report.caseCount),
      matchedCaseCount: Bool.match(result.matched, {
        onFalse: () => report.matchedCaseCount,
        onTrue: () => Num.increment(report.matchedCaseCount)
      }),
      totalLineCountError: Num.sum(report.totalLineCountError, Numeric.abs(result.lineCountDelta)),
      totalMaxLineWidthError: Num.sum(report.totalMaxLineWidthError, Numeric.abs(result.maxLineWidthDelta)),
      totalLineMismatchCount: Num.sum(report.totalLineMismatchCount, result.lineMismatchCount),
      results: Arr.append(report.results, result)
    })
  )
