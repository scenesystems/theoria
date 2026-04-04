/**
 * Private calibration-report helpers.
 *
 * @internal
 * @since 0.1.0
 */
import { Number as Num, Option } from "effect"
import * as Arr from "effect/Array"

import type { LayoutLineType, LayoutSummaryType } from "../../../Text/schema.js"
import type {
  CalibrationCaseResultType,
  CalibrationCaseType,
  CalibrationProfileType,
  CalibrationReportType,
  CalibrationTargetLineType,
  CalibrationTargetType
} from "../schema.js"

const matchesSummary = (expected: CalibrationTargetType, actual: LayoutSummaryType): boolean =>
  expected.lineCount === actual.lineCount && expected.maxLineWidth === actual.maxLineWidth

const matchesLine = (
  expected: Option.Option<CalibrationTargetLineType>,
  actual: Option.Option<LayoutLineType>
): boolean =>
  Option.all({ expected, actual }).pipe(
    Option.match({
      onNone: () => false,
      onSome: ({ expected: expectedLine, actual: actualLine }) =>
        expectedLine.text === actualLine.text &&
        expectedLine.width === actualLine.width
    })
  )

const lineMismatchCount = (
  expected: Option.Option<ReadonlyArray<CalibrationTargetLineType>>,
  actual: ReadonlyArray<LayoutLineType>
): number =>
  expected.pipe(
    Option.match({
      onNone: () => 0,
      onSome: (expectedLines) =>
        Arr.reduce(
          Arr.makeBy(Math.max(expectedLines.length, actual.length), (index) => index),
          0,
          (mismatchCount, index) =>
            mismatchCount +
            (matchesLine(Option.fromNullable(expectedLines[index]), Option.fromNullable(actual[index])) ? 0 : 1)
        )
    })
  )

const absoluteValue = (value: number): number => Num.lessThan(value, 0) ? Num.negate(value) : value

/**
 * Builds one case result by comparing expected calibration targets against actual layout output.
 *
 * @since 0.1.0
 * @category internals
 */
export const makeCaseResult = (
  calibrationCase: CalibrationCaseType,
  actual: LayoutSummaryType,
  actualLines: ReadonlyArray<LayoutLineType>
): CalibrationCaseResultType => {
  const mismatchCount = lineMismatchCount(Option.fromNullable(calibrationCase.expected.lines), actualLines)

  return {
    name: calibrationCase.name,
    expected: calibrationCase.expected,
    actual,
    actualLines,
    lineCountDelta: actual.lineCount - calibrationCase.expected.lineCount,
    maxLineWidthDelta: actual.maxLineWidth - calibrationCase.expected.maxLineWidth,
    lineMismatchCount: mismatchCount,
    matched: matchesSummary(calibrationCase.expected, actual) && mismatchCount === 0
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
  results: []
})

/**
 * Reduces per-case calibration results into the released aggregate report shape.
 *
 * @since 0.2.0
 * @category internals
 */
export const summarizeReport = (
  profile: CalibrationProfileType,
  results: ReadonlyArray<CalibrationCaseResultType>
): CalibrationReportType =>
  results.reduce(
    (report, result) => ({
      profile: report.profile,
      caseCount: Num.increment(report.caseCount),
      matchedCaseCount: result.matched ? Num.increment(report.matchedCaseCount) : report.matchedCaseCount,
      totalLineCountError: Num.sum(report.totalLineCountError, absoluteValue(result.lineCountDelta)),
      totalMaxLineWidthError: Num.sum(report.totalMaxLineWidthError, absoluteValue(result.maxLineWidthDelta)),
      totalLineMismatchCount: Num.sum(report.totalLineMismatchCount, result.lineMismatchCount),
      results: [...report.results, result]
    }),
    emptyReport(profile)
  )
