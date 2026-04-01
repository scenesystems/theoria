/**
 * Effectful evaluation for experimental calibration profiles.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"
import * as Arr from "effect/Array"

import { EngineProfile } from "../../Contracts/index.js"
import type { MeasurementCache, WordSegmenter } from "../../Contracts/index.js"
import type { MeasurementFailed } from "../../Errors/index.js"
import { prepare } from "../../Text/constructors.js"
import { layoutLines } from "../../Text/layout.js"
import type { LayoutLineType, LayoutSummaryType } from "../../Text/schema.js"
import type {
  CalibrationCaseResultType,
  CalibrationCaseType,
  CalibrationProfileType,
  CalibrationReportType,
  CalibrationTargetLineType,
  CalibrationTargetType
} from "./schema.js"

const matchesSummary = (expected: CalibrationTargetType, actual: LayoutSummaryType): boolean =>
  expected.lineCount === actual.lineCount && expected.maxLineWidth === actual.maxLineWidth

const summarizeLines = (
  lines: ReadonlyArray<LayoutLineType>,
  lineHeight: number
): LayoutSummaryType => ({
  lineCount: lines.length,
  height: lines.length * lineHeight,
  maxLineWidth: lines.reduce((maxWidth, line) => Math.max(maxWidth, line.width), 0)
})

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

const makeCaseResult = (
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

const emptyReport = (profile: CalibrationProfileType): CalibrationReportType => ({
  profile,
  caseCount: 0,
  matchedCaseCount: 0,
  totalLineCountError: 0,
  totalMaxLineWidthError: 0,
  totalLineMismatchCount: 0,
  results: []
})

/**
 * Evaluates a candidate engine profile against a typed calibration corpus.
 *
 * The helper preserves the current architecture: each sample is prepared effectfully
 * with the candidate profile in context, then scored with the pure `Text.layout`
 * projection.
 *
 * @since 0.1.0
 * @category evaluation
 */
export const evaluateProfile = (
  profile: CalibrationProfileType,
  cases: ReadonlyArray<CalibrationCaseType>
): Effect.Effect<CalibrationReportType, MeasurementFailed, WordSegmenter | MeasurementCache> =>
  Effect.forEach(cases, (calibrationCase) =>
    prepare(calibrationCase.prepare).pipe(
      Effect.provideService(EngineProfile, profile.engineProfile),
      Effect.map((prepared) => layoutLines(prepared, calibrationCase.layout)),
      Effect.map((actualLines) =>
        makeCaseResult(
          calibrationCase,
          summarizeLines(actualLines, calibrationCase.layout.lineHeight),
          actualLines
        )
      )
    )).pipe(
      Effect.map((results) =>
        results.reduce(
          (report, result) => ({
            profile: report.profile,
            caseCount: report.caseCount + 1,
            matchedCaseCount: report.matchedCaseCount + (result.matched ? 1 : 0),
            totalLineCountError: report.totalLineCountError + Math.abs(result.lineCountDelta),
            totalMaxLineWidthError: report.totalMaxLineWidthError + Math.abs(result.maxLineWidthDelta),
            totalLineMismatchCount: report.totalLineMismatchCount + result.lineMismatchCount,
            results: [...report.results, result]
          }),
          emptyReport(profile)
        )
      )
    )
