/**
 * Private calibration-report helpers.
 *
 * @internal
 */
import { Option } from "effect"
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
        Arr.makeBy(Math.max(expectedLines.length, actual.length), (index) => index).reduce<number>(
          (mismatchCount, index) =>
            mismatchCount +
            (matchesLine(Option.fromNullable(expectedLines[index]), Option.fromNullable(actual[index])) ? 0 : 1),
          0
        )
    })
  )

export const summarizeLines = (
  lines: ReadonlyArray<LayoutLineType>,
  lineHeight: number
): LayoutSummaryType => ({
  lineCount: lines.length,
  height: lines.length * lineHeight,
  maxLineWidth: lines.reduce((maxWidth, line) => Math.max(maxWidth, line.width), 0)
})

export const makeCaseResult = (
  calibrationCase: CalibrationCaseType,
  actual: LayoutSummaryType,
  actualLines: ReadonlyArray<LayoutLineType>
): CalibrationCaseResultType => ({
  name: calibrationCase.name,
  expected: calibrationCase.expected,
  actual,
  actualLines,
  lineCountDelta: actual.lineCount - calibrationCase.expected.lineCount,
  maxLineWidthDelta: actual.maxLineWidth - calibrationCase.expected.maxLineWidth,
  lineMismatchCount: lineMismatchCount(Option.fromNullable(calibrationCase.expected.lines), actualLines),
  matched: matchesSummary(calibrationCase.expected, actual) &&
    lineMismatchCount(Option.fromNullable(calibrationCase.expected.lines), actualLines) === 0
})

export const emptyReport = (profile: CalibrationProfileType): CalibrationReportType => ({
  profile,
  caseCount: 0,
  matchedCaseCount: 0,
  totalLineCountError: 0,
  totalMaxLineWidthError: 0,
  totalLineMismatchCount: 0,
  results: []
})
