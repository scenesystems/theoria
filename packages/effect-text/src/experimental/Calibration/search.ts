/**
 * Effect Search studies that tune engine profiles against weighted layout error.
 *
 * @since 0.2.0
 */
import type { Study } from "@scenesystems/effect-search"
import { Sampler, SearchSpace } from "@scenesystems/effect-search"
import { Data, Effect, Option } from "effect"
import type { Layer } from "effect"

import type { MeasurementCache, WordSegmenter } from "../../contracts/index.js"
import type { EngineProfileType } from "../../Text/schema.js"
import { evaluateProfile } from "./evaluation.js"
import { scoreCalibrationReportSync } from "./internal/scoring.js"
import {
  booleanChoices,
  calibrationProfile,
  defaultObjectiveMetadata,
  defaultSearchDescriptor,
  directionChoices,
  floatOptions,
  intOptions
} from "./internal/search.js"
import { runFreshCalibrationStudy, runResumedCalibrationStudy } from "./internal/study.js"
import type {
  CalibrationCasesType,
  CalibrationObjectiveMetadataType,
  CalibrationOptimizationReportType,
  CalibrationProfileType,
  CalibrationReportType,
  CalibrationSearchDescriptorType
} from "./schema.js"

/**
 * Configures one fresh or resumed experimental calibration optimization.
 *
 * @since 0.4.0
 * @category models
 */
export class OptimizeProfileOptions extends Data.Class<{
  /** Calibration corpus evaluated for every candidate. */
  readonly cases: CalibrationCasesType
  /** Segmentation and measurement-cache layer acquired for candidate evaluation. */
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  /** Fresh or additional trial budget; must be a non-negative integer. */
  readonly trials: number
  /** Weighted minimization policy; defaults to `DefaultCalibrationObjective`. */
  readonly objective?: CalibrationObjectiveMetadataType
  /** Candidate sampler; defaults to seed-zero TPE. */
  readonly sampler?: Sampler.Sampler
  /** Preferred engine-profile dimension descriptor. */
  readonly searchDescriptor?: CalibrationSearchDescriptorType
  /** Prior checkpoint whose completed trials seed the resumed study. */
  readonly snapshot?: Study.StudySnapshot
  /** Optional Effect Search persistence service for trial logs and checkpoints. */
  readonly studyStorage?: Study.StudyStorageApi
}> {}

/**
 * Selected profile, evaluated report, study result, and resumable artifacts.
 *
 * @since 0.4.0
 * @category models
 */
export class CalibrationOptimizationResult extends Data.Class<{
  /** Lowest-loss profile selected by the completed study. */
  readonly bestProfile: CalibrationProfileType
  /** Final evaluation of the selected profile. */
  readonly bestReport: CalibrationReportType
  /** Effect Search single-objective result. */
  readonly studyResult: Study.SingleObjectiveResult<EngineProfileType>
  /** Persistable optimization metadata and artifacts. */
  readonly optimization: CalibrationOptimizationReportType
}> {}

/**
 * Weighted-sum objective with multipliers 10,000 for line mismatches, 1,000 for
 * absolute line-count error, and 1 for absolute maximum-width error.
 *
 * @since 0.2.0
 * @category search
 */
export const DefaultCalibrationObjective = defaultObjectiveMetadata

/**
 * Search dimensions covering fit epsilon from 0 through 0.05 in 0.001 steps,
 * tab width from 2 through 8, both base directions, and both values of each
 * break preference.
 *
 * @since 0.2.0
 * @category search
 */
export const DefaultCalibrationSearchDescriptor = defaultSearchDescriptor

/**
 * Compiles engine-profile dimensions into an Effect Search configuration space.
 * Invalid ordering or distribution metadata fails with `InvalidSearchSpace`.
 *
 * @param searchDescriptor - Sampling dimensions; omission uses `DefaultCalibrationSearchDescriptor`.
 * @returns A space whose decoded configuration is an `EngineProfile` candidate.
 *
 * @since 0.2.0
 * @category search
 */
export const makeProfileSearchSpace = (
  searchDescriptor: CalibrationSearchDescriptorType = DefaultCalibrationSearchDescriptor
) =>
  SearchSpace.make({
    lineFitEpsilon: SearchSpace.float(
      searchDescriptor.lineFitEpsilon.low,
      searchDescriptor.lineFitEpsilon.high,
      floatOptions(searchDescriptor.lineFitEpsilon)
    ),
    tabWidth: SearchSpace.int(
      searchDescriptor.tabWidth.low,
      searchDescriptor.tabWidth.high,
      intOptions(searchDescriptor.tabWidth)
    ),
    defaultDirection: SearchSpace.categorical(directionChoices(searchDescriptor.defaultDirection)),
    preferEarlySoftHyphenBreak: SearchSpace.categorical(booleanChoices(searchDescriptor.preferEarlySoftHyphenBreak)),
    preferPrefixWidthsForBreakableRuns: SearchSpace.categorical(
      booleanChoices(searchDescriptor.preferPrefixWidthsForBreakableRuns)
    )
  })

/**
 * Runs an Effect Search study and selects the engine profile with the lowest
 * weighted calibration loss.
 *
 * @remarks
 * A supplied snapshot makes `trials` an additional-trial budget; without one it
 * is the fresh-study budget. The count must be a non-negative integer, and a
 * fresh study needs a successful trial before a best profile exists. Omission
 * of `sampler` selects a seed-zero TPE sampler.
 *
 * Candidate measurement failures become trial failures. If no trial succeeds,
 * the Effect fails with `NoSuccessfulTrials`. Search-space, sampler, snapshot,
 * and study validation failures remain in the Effect Search error channel.
 * Supplied `studyStorage` that holds no snapshot after the study ran fails with
 * `CalibrationSnapshotMissing`, and storage that resolves to a multi-objective
 * study fails with `CalibrationStudyNotSingleObjective`. The final evaluation
 * of the selected profile can fail with `MeasurementFailed`.
 * The returned event log contains this invocation's events; the snapshot holds
 * cumulative state for resumption.
 *
 * @returns The selected profile, its report, the Effect Search result, and persistable study artifacts.
 *
 * @since 0.2.0
 * @category search
 */
export const optimizeProfile = (options: OptimizeProfileOptions) =>
  Effect.gen(function*() {
    const objective = Option.fromNullable(options.objective).pipe(
      Option.getOrElse(() => DefaultCalibrationObjective)
    )
    const searchDescriptor = Option.fromNullable(options.searchDescriptor).pipe(
      Option.getOrElse(() => DefaultCalibrationSearchDescriptor)
    )
    const sampler = Option.fromNullable(options.sampler).pipe(
      Option.getOrElse(() => Sampler.tpe({ seed: 0 }))
    )
    const storage = Option.fromNullable(options.studyStorage)
    const space = yield* makeProfileSearchSpace(searchDescriptor)
    const study = yield* Option.fromNullable(options.snapshot).pipe(
      Option.match({
        onNone: () =>
          runFreshCalibrationStudy({
            cases: options.cases,
            objective,
            sampler,
            services: options.services,
            storage,
            space,
            trials: options.trials
          }),
        onSome: (snapshot) =>
          runResumedCalibrationStudy({
            cases: options.cases,
            objective,
            sampler,
            services: options.services,
            snapshot,
            storage,
            space,
            trials: options.trials
          })
      })
    )

    const bestProfile = calibrationProfile("best", study.studyResult.bestTrial.config)
    const bestReport = yield* evaluateProfile(bestProfile, options.cases).pipe(Effect.provide(options.services))
    const bestScore = scoreCalibrationReportSync(bestReport, objective)

    return new CalibrationOptimizationResult({
      bestProfile,
      bestReport,
      studyResult: study.studyResult,
      optimization: {
        objective,
        searchDescriptor,
        completionReason: study.studyResult.completionReason,
        bestScore: bestScore.total,
        bestLossSummary: bestScore.summary,
        artifacts: {
          snapshot: study.snapshot,
          eventLog: study.eventLog
        }
      }
    })
  })
