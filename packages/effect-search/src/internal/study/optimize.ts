/**
 * Effect APIs for complete optimization runs and versioned continuation.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"

import { type SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type { Result } from "../../Study.js"
import * as StudySnapshot from "../../StudySnapshot.js"
import type * as StudyStorage from "../../StudyStorage.js"
import type {
  OptimizeOptionsFromSpace,
  ResumeFromStorageOptionsFromSpace,
  ResumeOptionsFromSpace
} from "./options/input.js"
import type { OptimizePlan } from "./options/plan.js"
import { optimizePlanFromOptions } from "./options/plan/fresh.js"
import { resumeExecutionSeedFromOptions, resumeExecutionSeedFromStorageOptions } from "./recovery.js"
import { resultFromOutcome } from "./result.js"
import { defaultExecuteSeed, type ExecuteSeed, executeStudy } from "./runtime.js"

const executePlan = <Space extends SearchSpace.SearchSpace>(
  optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>,
  seed: Option.Option<ExecuteSeed<SearchSpace.Type<Space>>>
) =>
  executeStudy(
    optimizePlan,
    Option.getOrElse(seed, () => defaultExecuteSeed())
  ).pipe(Effect.flatMap(resultFromOutcome))

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
): Effect.Effect<Result<SearchSpace.Type<Space>>, SearchError> =>
  optimizePlanFromOptions(options).pipe(
    Effect.flatMap((optimizePlan) => executePlan(optimizePlan, Option.none())),
    Effect.withSpan("effect-search/Study.optimize")
  )

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
export const snapshot = <Config>(result: Result<Config>): Effect.Effect<StudySnapshot.Snapshot> =>
  Effect.succeed(StudySnapshot.make(result.trials, result.snapshotMetadata)).pipe(
    Effect.withSpan("effect-search/Study.snapshot")
  )

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
): Effect.Effect<Result<SearchSpace.Type<Space>>, SearchError> =>
  resumeExecutionSeedFromOptions(options).pipe(
    Effect.flatMap(({ optimizePlan, seed }) => executePlan(optimizePlan, Option.some(seed))),
    Effect.withSpan("effect-search/Study.resume")
  )

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
): Effect.Effect<Result<SearchSpace.Type<Space>>, SearchError, StudyStorage.StudyStorage> =>
  resumeExecutionSeedFromStorageOptions(options).pipe(
    Effect.flatMap(({ optimizePlan, seed }) => executePlan(optimizePlan, Option.some(seed))),
    Effect.withSpan("effect-search/Study.resumeFromStorage")
  )
