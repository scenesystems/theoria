/**
 * Expected-layout comparison and report aggregation.
 *
 * @internal
 * @since 0.5.0
 */
import * as Numeric from "@scenesystems/effect-math/Numeric"
import { Boolean as Bool, Effect, Number as Num, Option, String as Str } from "effect"
import * as Arr from "effect/Array"

import type * as Calibration from "../../Calibration.js"
import * as Text from "../../Text.js"

const matchesSummary = (expected: Calibration.Target, actual: Text.Summary): boolean =>
  Bool.and(
    Num.Equivalence(expected.lineCount, actual.lineCount),
    Num.Equivalence(expected.maxLineWidth, actual.maxLineWidth)
  )

const matchesLine = (
  expected: Option.Option<Calibration.TargetLine>,
  actual: Option.Option<Text.Line>
): boolean =>
  Option.all({ expected, actual }).pipe(
    Option.match({
      onNone: () => false,
      onSome: ({ expected: expectedLine, actual: actualLine }) =>
        Bool.and(
          Str.Equivalence(expectedLine.text, actualLine.text),
          Num.Equivalence(expectedLine.width, actualLine.width)
        )
    })
  )

const lineMismatchCount = (
  expected: Option.Option<Calibration.TargetLines>,
  actual: Text.Lines
): number =>
  expected.pipe(
    Option.match({
      onNone: () => 0,
      onSome: (expectedLines) =>
        Arr.reduce(
          Arr.union(
            Arr.map(expectedLines, (_line, index) => index),
            Arr.map(actual, (_line, index) => index)
          ),
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

const makeCaseResult = (
  calibrationCase: Calibration.Case,
  actual: Text.Summary,
  actualLines: Text.Lines
): Calibration.CaseResult => {
  const mismatchCount = lineMismatchCount(Option.fromNullable(calibrationCase.expected.lines), actualLines)

  return {
    name: calibrationCase.name,
    expected: calibrationCase.expected,
    actual,
    actualLines,
    lineCountDelta: Num.subtract(actual.lineCount, calibrationCase.expected.lineCount),
    maxLineWidthDelta: Num.subtract(actual.maxLineWidth, calibrationCase.expected.maxLineWidth),
    lineMismatchCount: mismatchCount,
    matched: Bool.and(matchesSummary(calibrationCase.expected, actual), Num.Equivalence(mismatchCount, 0))
  }
}

const emptyReport = (profile: Calibration.Profile): Calibration.Report => ({
  profile,
  caseCount: 0,
  matchedCaseCount: 0,
  totalLineCountError: 0,
  totalMaxLineWidthError: 0,
  totalLineMismatchCount: 0,
  results: Arr.empty()
})

const summarizeReport = (
  profile: Calibration.Profile,
  results: Calibration.CaseResults
): Calibration.Report =>
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

/** @internal */
export const evaluate = (profile: Calibration.Profile, cases: Calibration.Cases) =>
  Effect.forEach(cases, (calibrationCase) =>
    Text.prepareWithSegments(calibrationCase.prepare).pipe(
      Effect.provideService(Text.CurrentProfile, profile.profile),
      Effect.map((prepared) => {
        const actual = Text.layout(prepared, calibrationCase.layout)

        return makeCaseResult(calibrationCase, actual.summary, actual.lines)
      })
    )).pipe(
      Effect.map((results) => summarizeReport(profile, results))
    )
