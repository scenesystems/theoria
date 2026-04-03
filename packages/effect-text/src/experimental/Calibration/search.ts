/**
 * effect-search-backed calibration helpers for experimental engine-profile tuning.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"
import type { Layer } from "effect"
import { Sampler, SearchSpace, Study } from "effect-search"

import type { MeasurementCache, WordSegmenter } from "../../contracts/index.js"
import { evaluateProfile } from "./evaluation.js"
import {
  calibrationProfile,
  defaultSearchSpaceSpec,
  floatOptions,
  intOptions,
  numericSearchScore
} from "./internal/search.js"
import type { CalibrationCaseType, CalibrationSearchSpaceSpecType } from "./schema.js"

/**
 * Compiles a default `effect-search` search space for engine-profile tuning.
 *
 * The resulting space always includes the boolean and direction switches used
 * by the current runtime profile, while numeric ranges are supplied by the
 * caller through `CalibrationSearchSpaceSpec`.
 *
 * @since 0.1.0
 * @category search
 */
export const makeProfileSearchSpace = (searchSpaceSpec: CalibrationSearchSpaceSpecType = defaultSearchSpaceSpec) =>
  SearchSpace.make({
    lineFitEpsilon: SearchSpace.float(
      searchSpaceSpec.lineFitEpsilon.low,
      searchSpaceSpec.lineFitEpsilon.high,
      floatOptions(searchSpaceSpec.lineFitEpsilon)
    ),
    tabWidth: SearchSpace.int(
      searchSpaceSpec.tabWidth.low,
      searchSpaceSpec.tabWidth.high,
      intOptions(searchSpaceSpec.tabWidth)
    ),
    defaultDirection: SearchSpace.categorical(["ltr", "rtl"]),
    preferEarlySoftHyphenBreak: SearchSpace.boolean(),
    preferPrefixWidthsForBreakableRuns: SearchSpace.boolean()
  })

/**
 * Runs an `effect-search` study over candidate engine profiles.
 *
 * The search objective is intentionally simple for the first experimental lane:
 * it reuses `evaluateProfile`, then minimizes a scalar score that heavily weights
 * exact line mismatches first, line-count mismatches second, and width error last.
 *
 * @since 0.1.0
 * @category search
 */
export const optimizeProfile = (options: {
  readonly cases: ReadonlyArray<CalibrationCaseType>
  readonly services: Layer.Layer<WordSegmenter | MeasurementCache>
  readonly trials: number
  readonly concurrency?: number
  readonly sampler?: Sampler.Sampler
  readonly searchSpaceSpec?: CalibrationSearchSpaceSpecType
}) =>
  Effect.gen(function*() {
    const space = yield* makeProfileSearchSpace(options.searchSpaceSpec)
    const concurrency = Option.fromNullable(options.concurrency).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (resolvedConcurrency) => ({ concurrency: resolvedConcurrency })
      })
    )
    const studyResult = yield* Study.minimize({
      space,
      sampler: options.sampler ?? Sampler.tpe(),
      trials: options.trials,
      ...concurrency,
      objective: (engineProfile) =>
        evaluateProfile(calibrationProfile("candidate", engineProfile), options.cases).pipe(
          Effect.provide(options.services),
          Effect.map(numericSearchScore)
        )
    })

    if (studyResult._tag !== "SingleObjective") {
      return yield* Effect.die("effect-search Study.minimize returned a non-single-objective result")
    }

    const bestProfile = calibrationProfile("best", studyResult.bestTrial.config)
    const bestReport = yield* evaluateProfile(bestProfile, options.cases).pipe(Effect.provide(options.services))

    return {
      bestProfile,
      bestReport,
      studyResult
    }
  })
