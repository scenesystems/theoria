/**
 * effect-search-backed calibration helpers for experimental engine-profile tuning.
 *
 * @since 0.2.0
 */
import { Effect, Option } from "effect"
import type { Layer } from "effect"
import type { Study } from "effect-search"
import { Sampler, SearchSpace } from "effect-search"

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
 * Default experimental score policy for profile optimization.
 *
 * @since 0.2.0
 * @category search
 */
export const DefaultCalibrationObjective = defaultObjectiveMetadata

/**
 * Default search-descriptor authority for engine-profile tuning.
 *
 * @since 0.2.0
 * @category search
 */
export const DefaultCalibrationSearchDescriptor = defaultSearchDescriptor

/**
 * Compiles the experimental engine-profile descriptor into an `effect-search`
 * search space.
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
 * Runs an experimental `effect-search` study over candidate engine profiles.
 *
 * The runtime hot path stays unchanged: candidate profiles are evaluated by
 * reusing `evaluateProfile`, which itself composes on top of `Text.prepare`
 * plus the pure layout plane.
 *
 * @since 0.2.0
 * @category search
 */
export const optimizeProfile = (options: {
  readonly cases: ReadonlyArray<CalibrationCaseType>
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly trials: number
  readonly objective?: CalibrationObjectiveMetadataType
  readonly sampler?: Sampler.Sampler
  readonly searchDescriptor?: CalibrationSearchDescriptorType
  readonly searchSpaceSpec?: CalibrationSearchSpaceSpecType
  readonly snapshot?: Study.StudySnapshot
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
