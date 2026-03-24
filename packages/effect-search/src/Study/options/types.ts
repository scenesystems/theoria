/**
 * Type definitions for user-facing optimization, resume, and scheduling options.
 *
 * @since 0.1.0
 */
import type { Duration } from "effect"

import type { Direction } from "../../contracts/Direction.js"
import type * as Sampler from "../../Sampler/index.js"
import type * as Scheduler from "../../Scheduler/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import type { ObjectiveFunction } from "../objectiveEvaluator.js"
import type { PruningPolicy, StopMode } from "../runtime/pruning.js"
import type { StudySnapshot } from "../snapshot/versioning.js"
import type { OptimizePlan, PriorTrial, RetrySchedule } from "./model.js"

/**
 * Flat (non-scheduled) optimization configuration — sampler, space, objective,
 * stopping criteria, and concurrency are specified directly rather than via a
 * {@link Scheduler}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type FlatOptimizeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = {
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly objective: ObjectiveFunction<Config>
  readonly direction?: Direction
  readonly directions?: ReadonlyArray<Direction>
  readonly pruningPolicy?: PruningPolicy
  readonly stopMode?: StopMode
  readonly trials: number
  readonly concurrency?: number
  readonly priorTrials?: ReadonlyArray<PriorTrial<Config>>
  readonly priorWeight?: number
  readonly maxCost?: number
  readonly evaluationsPerTrial?: number
  readonly maxDuration?: Duration.DurationInput
  readonly targetValue?: number
  readonly noImprovementWindow?: number
  readonly epsilon?: number
  readonly retrySchedule?: RetrySchedule
  readonly trialTimeout?: Duration.DurationInput
} & {}

/**
 * @since 0.1.0
 * @category type-level
 */
export type ScheduledOptimizeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = {
  readonly space: Space
  readonly scheduler: Scheduler.Scheduler
  readonly objective: ObjectiveFunction<Config>
  readonly direction?: Direction
  readonly directions?: ReadonlyArray<Direction>
  readonly pruningPolicy?: PruningPolicy
  readonly stopMode?: StopMode
  readonly concurrency?: number
  readonly priorTrials?: ReadonlyArray<PriorTrial<Config>>
  readonly priorWeight?: number
  readonly maxCost?: number
  readonly evaluationsPerTrial?: number
  readonly maxDuration?: Duration.DurationInput
  readonly targetValue?: number
  readonly noImprovementWindow?: number
  readonly epsilon?: number
  readonly retrySchedule?: RetrySchedule
  readonly trialTimeout?: Duration.DurationInput
} & {}

/**
 * @since 0.1.0
 * @category type-level
 */
export type OptimizeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = FlatOptimizeOptions<Config, Space> | ScheduledOptimizeOptions<Config, Space>

/**
 * @since 0.1.0
 * @category type-level
 */
export type OptimizeOptionsFromSpace<Space extends SearchSpace.SearchSpace> = OptimizeOptions<
  SearchSpace.Type<Space>,
  Space
>

/**
 * Shared fields for resuming a study — identical to optimize options minus
 * prior-trial seeding, since history is restored from the snapshot.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResumeOptionFields<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = {
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly objective: ObjectiveFunction<Config>
  readonly direction?: Direction
  readonly directions?: ReadonlyArray<Direction>
  readonly pruningPolicy?: PruningPolicy
  readonly stopMode?: StopMode
  readonly trials: number
  readonly concurrency?: number
  readonly maxCost?: number
  readonly evaluationsPerTrial?: number
  readonly maxDuration?: Duration.DurationInput
  readonly targetValue?: number
  readonly noImprovementWindow?: number
  readonly epsilon?: number
  readonly retrySchedule?: RetrySchedule
  readonly trialTimeout?: Duration.DurationInput
} & {}

/**
 * Resume configuration paired with an in-memory {@link StudySnapshot}.
 * Use when the snapshot is already loaded into the caller's process.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResumeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = ResumeOptionFields<Config, Space> & {
  readonly snapshot: StudySnapshot
}

/**
 * Resume configuration without an explicit snapshot — the runtime loads
 * the latest snapshot from the configured storage backend automatically.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResumeFromStorageOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = ResumeOptionFields<Config, Space>

/**
 * @since 0.1.0
 * @category type-level
 */
export type ResumeOptionsFromSpace<Space extends SearchSpace.SearchSpace> = ResumeOptions<
  SearchSpace.Type<Space>,
  Space
>

/**
 * @since 0.1.0
 * @category type-level
 */
export type ResumeFromStorageOptionsFromSpace<Space extends SearchSpace.SearchSpace> = ResumeFromStorageOptions<
  SearchSpace.Type<Space>,
  Space
>

/**
 * @since 0.1.0
 * @category type-level
 */
export type OptimizeSettingsSource<Config, Space extends SearchSpace.SearchSpace> = OptimizePlan<Config, Space>
