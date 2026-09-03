/**
 * Effect Search studies that tune engine profiles against weighted layout error.
 *
 * @since 0.2.0
 */
import type { Study } from "@scenesystems/effect-search"
import { Sampler, SearchSpace } from "@scenesystems/effect-search"
import { Effect, Option } from "effect"
import type { Layer } from "effect"

import type { MeasurementCache, WordSegmenter } from "../../contracts/index.js"
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
  CalibrationCaseType,
  CalibrationObjectiveMetadataType,
  CalibrationSearchDescriptorType,
  CalibrationSearchSpaceSpecType
} from "./schema.js"

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
 * and study validation failures remain in the Effect Search error channel. The
 * final evaluation of the selected profile can fail with `MeasurementFailed`.
 * The returned event log contains this invocation's events; the snapshot holds
 * cumulative state for resumption.
 *
 * @returns The selected profile, its report, the Effect Search result, and persistable study artifacts.
 *
 * @since 0.2.0
 * @category search
 */
export const optimizeProfile = (options: {
  /** Calibration corpus evaluated for every candidate. */
  readonly cases: ReadonlyArray<CalibrationCaseType>
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
  /** Compatibility option used only when `searchDescriptor` is absent. */
  readonly searchSpaceSpec?: CalibrationSearchSpaceSpecType
  /** Prior checkpoint whose completed trials seed the resumed study. */
  readonly snapshot?: Study.StudySnapshot
  /** Optional Effect Search persistence service for trial logs and checkpoints. */
  readonly studyStorage?: Study.StudyStorageApi
}) =>
  Effect.gen(function*() {
    const objective = options.objective ?? DefaultCalibrationObjective
    const searchDescriptor = options.searchDescriptor ?? options.searchSpaceSpec ?? DefaultCalibrationSearchDescriptor
    const sampler = options.sampler ?? Sampler.tpe({ seed: 0 })
    const space = yield* makeProfileSearchSpace(searchDescriptor)
    const study = yield* Option.fromNullable(options.snapshot).pipe(
      Option.match({
        onNone: () =>
          runFreshCalibrationStudy({
            cases: options.cases,
            objective,
            sampler,
            services: options.services,
            storage: Option.fromNullable(options.studyStorage),
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
            storage: Option.fromNullable(options.studyStorage),
            space,
            trials: options.trials
          })
      })
    )

    const bestProfile = calibrationProfile("best", study.studyResult.bestTrial.config)
    const bestReport = yield* evaluateProfile(bestProfile, options.cases).pipe(Effect.provide(options.services))
    const bestScore = scoreCalibrationReportSync(bestReport, objective)

    return {
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
    }
  })
