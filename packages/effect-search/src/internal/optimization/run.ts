/**
 * Effect APIs for optimization runs and checkpoint continuation.
 *
 * @since 0.1.0
 */
import { Effect, Option } from "effect"

import type * as Optimization from "../../Optimization.js"
import * as OptimizationSnapshot from "../../OptimizationSnapshot.js"
import type * as OptimizationStorage from "../../OptimizationStorage.js"
import { type SearchError } from "../../SearchError.js"
import type * as SearchSpace from "../../SearchSpace.js"
import type { OptimizePlan } from "./options/plan.js"
import { optimizePlanFromOptions } from "./options/plan/fresh.js"
import { resumeExecutionSeedFromOptions, resumeExecutionSeedFromStorageOptions } from "./recovery.js"
import { resultFromOutcome } from "./result.js"
import { defaultExecuteSeed, executeOptimization, type ExecuteSeed } from "./runtime.js"

const executePlan = <Space extends SearchSpace.SearchSpace>(
  optimizePlan: OptimizePlan<SearchSpace.Type<Space>, Space>,
  seed: Option.Option<ExecuteSeed<SearchSpace.Type<Space>>>
) =>
  executeOptimization(
    optimizePlan,
    Option.getOrElse(seed, () => defaultExecuteSeed())
  ).pipe(Effect.flatMap(resultFromOutcome))

/**
 * Executes a flat or scheduled optimization and returns its best scalar trial or
 * epsilon-aware Pareto front. Objective failures are recorded as failed trials;
 * invalid configuration, sampler failures, and a run with no successful trial
 * fail through `SearchError`.
 *
 * @remarks
 * The function supplies the default optimization services. Optional objective-cache
 * and storage services can be provided by the caller.
 *
 * @typeParam Space - Compiled search space supplying objective inputs and result configurations.
 *
 * @since 0.1.0
 * @category combinators
 */
export const run = <Space extends SearchSpace.SearchSpace>(
  options: Optimization.Options<SearchSpace.Type<Space>, Space>
): Effect.Effect<Optimization.Result<SearchSpace.Type<Space>>, SearchError> =>
  optimizePlanFromOptions(options).pipe(
    Effect.flatMap((optimizePlan) => executePlan(optimizePlan, Option.none())),
    Effect.withSpan("effect-search/Optimization.run")
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
export const snapshot = <Config>(
  result: Optimization.Result<Config>
): Effect.Effect<OptimizationSnapshot.OptimizationSnapshot> =>
  Effect.succeed(OptimizationSnapshot.make(result.trials, result.snapshotMetadata)).pipe(
    Effect.withSpan("effect-search/Optimization.snapshot")
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
  options: Optimization.ResumeOptions<SearchSpace.Type<Space>, Space>
): Effect.Effect<Optimization.Result<SearchSpace.Type<Space>>, SearchError> =>
  resumeExecutionSeedFromOptions(options).pipe(
    Effect.flatMap(({ optimizePlan, seed }) => executePlan(optimizePlan, Option.some(seed))),
    Effect.withSpan("effect-search/Optimization.resume")
  )

/**
 * Loads the latest snapshot and replay tail from {@link OptimizationStorage}, validates
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
  options: Optimization.StorageResumeOptions<SearchSpace.Type<Space>, Space>
): Effect.Effect<Optimization.Result<SearchSpace.Type<Space>>, SearchError, OptimizationStorage.OptimizationStorage> =>
  resumeExecutionSeedFromStorageOptions(options).pipe(
    Effect.flatMap(({ optimizePlan, seed }) => executePlan(optimizePlan, Option.some(seed))),
    Effect.withSpan("effect-search/Optimization.resumeFromStorage")
  )
