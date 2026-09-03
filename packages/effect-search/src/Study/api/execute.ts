/**
 * Effect APIs for complete optimization runs and versioned continuation.
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
 * Executes a flat or scheduled study and returns its best scalar trial or
 * epsilon-aware Pareto front. Objective failures are recorded as failed trials;
 * invalid configuration, sampler failures, and a run with no successful trial
 * fail through `SearchError`.
 *
 * @remarks
 * The function supplies the default study services. Optional objective-cache
 * and storage services can be provided by the caller.
 *
 * @typeParam Space - Compiled search space supplying objective inputs and result configurations.
 *
 * @example
 * ```ts
 * import { Effect, Match } from "effect"
 * import * as Numeric from "@scenesystems/effect-math/Numeric"
 * import * as Sampler from "@scenesystems/effect-search/Sampler"
 * import * as SearchSpace from "@scenesystems/effect-search/SearchSpace"
 * import { optimize } from "@scenesystems/effect-search/Study"
 *
 * export const program = Effect.gen(function*() {
 *   const space = yield* SearchSpace.make({ x: SearchSpace.float(-2, 2) })
 *   const result = yield* optimize({
 *     space,
 *     sampler: Sampler.random({ seed: 7 }),
 *     direction: "minimize",
 *     trials: 8,
 *     objective: ({ x }) => Effect.succeed(Numeric.pow(x, 2))
 *   })
 *
 *   return yield* Match.value(result).pipe(
 *     Match.tag("SingleObjective", (single) =>
 *       Effect.succeed(single).pipe(
 *         Effect.filterOrFail(
 *           ({ trials }) => trials.length === 8,
 *           () => "UnexpectedTrialCount"
 *         )
 *       )
 *     ),
 *     Match.tag("MultiObjective", () => Effect.fail("UnexpectedResultKind")),
 *     Match.exhaustive
 *   )
 * })
 * ```
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
 * Runs {@link optimize} with minimization fixed for a scalar objective.
 *
 * @remarks
 * Validation, service, failure, and result semantics match `optimize`.
 *
 * @typeParam Space - Compiled search space supplying objective inputs and result configurations.
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
 * Runs a scalar-objective study that treats higher values as better.
 *
 * @remarks
 * Validation, service, failure, and result semantics match {@link optimize}.
 *
 * @typeParam Space - Compiled search space supplying objective inputs and result configurations.
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
 * Converts an immutable result into the canonical replay snapshot. The result's
 * sampler checkpoint and compatibility metadata are retained with every trial;
 * event history is not stored.
 *
 * @typeParam Config - Decoded configuration stored in the result's trial history.
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
 * Validates a snapshot against the requested search space, objective, stop mode,
 * and sampler before continuing it. `trials` is the number of additional trials
 * to schedule after the snapshot's `nextTrialNumber`.
 *
 * @remarks
 * Snapshot decoding, compatibility checks, sampler restoration, execution, and
 * result construction fail through `SearchError`.
 *
 * @typeParam Space - Compiled search space checked against the snapshot and used for new trials.
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
 * Loads the latest snapshot and replay tail from {@link StudyStorage}, validates
 * them, and schedules the requested number of additional trials. Missing or
 * invalid persisted state fails through `SearchError`; the storage service
 * remains a requirement of the returned Effect.
 *
 * @typeParam Space - Compiled search space checked against persisted state and used for new trials.
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
