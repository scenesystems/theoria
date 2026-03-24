/**
 * Top-level study execution API for running optimization, resuming, and collecting snapshots.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"

import { type SearchError } from "../../Errors/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import {
  type OptimizeOptionsFromSpace,
  type OptimizePlan,
  optimizePlanFromOptions,
  type ResumeFromStorageOptionsFromSpace,
  type ResumeOptionsFromSpace
} from "../options.js"
import {
  type MaximizeOptionsFromSpace,
  maximizePlanFromOptions,
  type MinimizeOptionsFromSpace,
  minimizePlanFromOptions
} from "../options/directional.js"
import { type ExecuteSeed } from "../runtime.js"
import { ExecuteRequest, SnapshotCodec, StudyKernel, StudyServicesLive } from "../services.js"
import { type StudySnapshot } from "../snapshot/versioning.js"
import type { StudyStorage } from "../studyStorage.js"
import { type StudyResult, studyResultFromOutcome } from "./result.js"
import { resumeExecutionSeedFromOptions, resumeExecutionSeedFromStorageOptions } from "./resumeSeed.js"

const executePlan = <Space extends SearchSpace.SearchSpace>(
  optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>,
  seed: Option.Option<ExecuteSeed<SearchSpace.Type<Space>>>
) =>
  Effect.gen(function*() {
    const studyKernel = yield* StudyKernel
    const outcome = yield* studyKernel.execute(
      new ExecuteRequest({ options: optimizePlan, seed, eventPublisher: Option.none() })
    )
    return yield* studyResultFromOutcome(outcome)
  })

/**
 * Run an optimization study to completion and return the best result.
 *
 * @since 0.1.0
 * @category combinators
 */
export const optimize = <Space extends SearchSpace.SearchSpace>(
  options: OptimizeOptionsFromSpace<Space>
): Effect.Effect<StudyResult<SearchSpace.Type<Space>>, SearchError> =>
  Effect.fn("effect-search/Study.optimize")(
    <CurrentSpace extends SearchSpace.SearchSpace>(
      currentOptions: OptimizeOptionsFromSpace<CurrentSpace>
    ): Effect.Effect<StudyResult<SearchSpace.Type<CurrentSpace>>, SearchError> =>
      optimizePlanFromOptions(currentOptions).pipe(
        Effect.flatMap((optimizePlan) => executePlan(optimizePlan, Option.none())),
        Effect.provide(StudyServicesLive)
      )
  )(options)

/**
 * Run a single-objective minimization study.
 *
 * @since 0.1.0
 * @category combinators
 */
export const minimize = <Space extends SearchSpace.SearchSpace>(
  options: MinimizeOptionsFromSpace<Space>
): Effect.Effect<StudyResult<SearchSpace.Type<Space>>, SearchError> =>
  Effect.fn("effect-search/Study.minimize")(
    <CurrentSpace extends SearchSpace.SearchSpace>(
      currentOptions: MinimizeOptionsFromSpace<CurrentSpace>
    ): Effect.Effect<StudyResult<SearchSpace.Type<CurrentSpace>>, SearchError> =>
      minimizePlanFromOptions(currentOptions).pipe(
        Effect.flatMap((optimizePlan) => executePlan(optimizePlan, Option.none())),
        Effect.provide(StudyServicesLive)
      )
  )(options)

/**
 * Run a single-objective maximization study.
 *
 * @since 0.1.0
 * @category combinators
 */
export const maximize = <Space extends SearchSpace.SearchSpace>(
  options: MaximizeOptionsFromSpace<Space>
): Effect.Effect<StudyResult<SearchSpace.Type<Space>>, SearchError> =>
  Effect.fn("effect-search/Study.maximize")(
    <CurrentSpace extends SearchSpace.SearchSpace>(
      currentOptions: MaximizeOptionsFromSpace<CurrentSpace>
    ): Effect.Effect<StudyResult<SearchSpace.Type<CurrentSpace>>, SearchError> =>
      maximizePlanFromOptions(currentOptions).pipe(
        Effect.flatMap((optimizePlan) => executePlan(optimizePlan, Option.none())),
        Effect.provide(StudyServicesLive)
      )
  )(options)

/**
 * Create a serializable snapshot from a study result.
 *
 * @since 0.1.0
 * @category combinators
 */
export const snapshot = <Config>(result: StudyResult<Config>): Effect.Effect<StudySnapshot> =>
  Effect.fn("effect-search/Study.snapshot")(
    <CurrentConfig>(currentResult: StudyResult<CurrentConfig>): Effect.Effect<StudySnapshot> =>
      Effect.gen(function*() {
        const snapshotCodec = yield* SnapshotCodec
        return snapshotCodec.snapshot(currentResult.trials, currentResult.snapshotMetadata)
      }).pipe(Effect.provide(StudyServicesLive))
  )(result)

/**
 * Resume a study from a snapshot.
 *
 * @since 0.1.0
 * @category combinators
 */
export const resume = <Space extends SearchSpace.SearchSpace>(
  options: ResumeOptionsFromSpace<Space>
): Effect.Effect<StudyResult<SearchSpace.Type<Space>>, SearchError> =>
  Effect.fn("effect-search/Study.resume")(
    <CurrentSpace extends SearchSpace.SearchSpace>(
      currentOptions: ResumeOptionsFromSpace<CurrentSpace>
    ): Effect.Effect<StudyResult<SearchSpace.Type<CurrentSpace>>, SearchError> =>
      resumeExecutionSeedFromOptions(currentOptions).pipe(
        Effect.flatMap(({ optimizePlan, seed }) => executePlan(optimizePlan, Option.some(seed))),
        Effect.provide(StudyServicesLive)
      )
  )(options)

/**
 * Resume a study from persisted StudyStorage snapshot/log state.
 *
 * @since 0.1.0
 * @category combinators
 */
export const resumeFromStorage = <Space extends SearchSpace.SearchSpace>(
  options: ResumeFromStorageOptionsFromSpace<Space>
): Effect.Effect<StudyResult<SearchSpace.Type<Space>>, SearchError, StudyStorage> =>
  Effect.fn("effect-search/Study.resumeFromStorage")(
    <CurrentSpace extends SearchSpace.SearchSpace>(
      currentOptions: ResumeFromStorageOptionsFromSpace<CurrentSpace>
    ): Effect.Effect<StudyResult<SearchSpace.Type<CurrentSpace>>, SearchError, StudyStorage> =>
      resumeExecutionSeedFromStorageOptions(currentOptions).pipe(
        Effect.flatMap(({ optimizePlan, seed }) => executePlan(optimizePlan, Option.some(seed))),
        Effect.provide(StudyServicesLive)
      )
  )(options)
