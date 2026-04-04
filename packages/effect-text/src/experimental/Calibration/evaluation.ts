/**
 * Effectful evaluation for experimental calibration profiles.
 *
 * @since 0.1.0
 */
import { Effect } from "effect"

import { EngineProfile } from "../../contracts/index.js"
import type { MeasurementCache, WordSegmenter } from "../../contracts/index.js"
import type { MeasurementFailed } from "../../Errors/index.js"
import { prepareWithSegments } from "../../Text/constructors.js"
import { layoutLines } from "../../Text/layout.js"
import { emptyReport, makeCaseResult, summarizeLines } from "./internal/evaluation.js"
import type { CalibrationCaseType, CalibrationProfileType, CalibrationReportType } from "./schema.js"

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
    prepareWithSegments(calibrationCase.prepare).pipe(
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
