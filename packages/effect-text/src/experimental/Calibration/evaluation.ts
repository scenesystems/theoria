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
import { layout, layoutLines } from "../../Text/layout.js"
import { makeCaseResult, summarizeReport } from "./internal/evaluation.js"
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
      Effect.map((prepared) => ({
        actual: layout(prepared, calibrationCase.layout),
        actualLines: layoutLines(prepared, calibrationCase.layout)
      })),
      Effect.map(({ actual, actualLines }) => makeCaseResult(calibrationCase, actual, actualLines))
    )).pipe(
      Effect.map((results) => summarizeReport(profile, results))
    )
