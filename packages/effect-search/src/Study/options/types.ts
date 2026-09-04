/**
 * User-facing option shapes for fresh and resumed studies.
 *
 * @since 0.1.0
 */
import { Data } from "effect"
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
 * Configures a study that asks one sampler for `trials` configurations. A
 * non-empty `directions` array selects a vector objective and takes precedence
 * over `direction`; otherwise the scalar direction defaults to `"minimize"`.
 *
 * @remarks
 * Concurrency and evaluations per trial default to one. Pruning defaults to
 * never, stop mode defaults to `Drain`, prior weight defaults to one, and
 * epsilon defaults to zero. The default retry schedule performs up to three
 * jittered exponential retries starting at 100 milliseconds.
 *
 * `targetValue` and `noImprovementWindow` apply only to scalar objectives.
 * Positive epsilon applies only to vector objectives. A cost budget stops new
 * work after cumulative reported cost becomes greater than `maxCost`; concurrent
 * work already running may increase the final total.
 *
 * @typeParam Config - Decoded search-space configuration passed to the objective.
 * @typeParam Space - Compiled search space retained for callback and result inference.
 *
 * @since 0.1.0
 * @category type-level
 */
export class FlatOptimizeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  /** Compiled space used to decode sampler suggestions. */
  readonly space: Space
  /** Sampler asked for each fresh configuration. */
  readonly sampler: Sampler.Sampler
  /** Effectful evaluation invoked with decoded configurations. */
  readonly objective: ObjectiveFunction<Config>
  /** Scalar comparison direction; omission resolves to `"minimize"`. */
  readonly direction?: Direction
  /** Ordered directions for vector coordinates; a non-empty array takes precedence over `direction`. */
  readonly directions?: ReadonlyArray<Direction>
  /** Policy consulted after an objective reports an intermediate value. */
  readonly pruningPolicy?: PruningPolicy
  /** Cooperative stop behavior; omission resolves to `"Drain"`. */
  readonly stopMode?: StopMode
  /** Non-negative number of fresh trials to admit. */
  readonly trials: number
  /** Positive maximum number of active trial evaluations; omission resolves to one. */
  readonly concurrency?: number
  /** Completed observations inserted before fresh sampling begins. */
  readonly priorTrials?: ReadonlyArray<PriorTrial<Config>>
  /** Non-negative weight assigned to each prior observation; omission resolves to one. */
  readonly priorWeight?: number
  /** Non-negative cumulative cost limit in the units reported by the objective. */
  readonly maxCost?: number
  /** Positive number of objective samples averaged per trial; omission resolves to one. */
  readonly evaluationsPerTrial?: number
  /** Elapsed-time limit for the study execution. */
  readonly maxDuration?: Duration.DurationInput
  /** Finite scalar value that stops admission once reached in the selected direction. */
  readonly targetValue?: number
  /** Positive number of completed scalar trials allowed without a new best value. */
  readonly noImprovementWindow?: number
  /** Non-negative vector dominance tolerance; omission resolves to zero. */
  readonly epsilon?: number
  /** Schedule advanced after a failed objective attempt; omission uses the package backoff schedule. */
  readonly retrySchedule?: RetrySchedule
  /** Time limit covering all objective samples and retries for one trial. */
  readonly trialTimeout?: Duration.DurationInput
}> {}

/**
 * Uses a {@link Scheduler} to choose the sampler, bracket topology, resource
 * levels, and planned trial count. Scheduler execution accepts only a scalar
 * objective. All other defaults and stopping semantics match
 * {@link FlatOptimizeOptions}.
 *
 * @typeParam Config - Decoded search-space configuration passed to the objective.
 * @typeParam Space - Compiled search space retained for callback and result inference.
 *
 * @since 0.1.0
 * @category type-level
 */
export class ScheduledOptimizeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  /** Compiled space used to decode scheduler sampler suggestions. */
  readonly space: Space
  /** Bracket and resource schedule that selects the sampler and total trial count. */
  readonly scheduler: Scheduler.Scheduler
  /** Effectful evaluation invoked with decoded configurations and allocated resources. */
  readonly objective: ObjectiveFunction<Config>
  /** Scalar comparison direction; omission resolves to `"minimize"`. */
  readonly direction?: Direction
  /** Vector directions rejected by scheduler execution when non-empty. */
  readonly directions?: ReadonlyArray<Direction>
  /** Policy consulted after an objective reports an intermediate value. */
  readonly pruningPolicy?: PruningPolicy
  /** Cooperative stop behavior; omission resolves to `"Drain"`. */
  readonly stopMode?: StopMode
  /** Positive maximum number of active trial evaluations; omission resolves to one. */
  readonly concurrency?: number
  /** Completed observations inserted before scheduled sampling begins. */
  readonly priorTrials?: ReadonlyArray<PriorTrial<Config>>
  /** Non-negative weight assigned to each prior observation; omission resolves to one. */
  readonly priorWeight?: number
  /** Non-negative cumulative cost limit in the units reported by the objective. */
  readonly maxCost?: number
  /** Positive number of objective samples averaged per trial; omission resolves to one. */
  readonly evaluationsPerTrial?: number
  /** Elapsed-time limit for the scheduled execution. */
  readonly maxDuration?: Duration.DurationInput
  /** Finite scalar value that stops admission once reached in the selected direction. */
  readonly targetValue?: number
  /** Positive number of completed trials allowed without a new best scalar value. */
  readonly noImprovementWindow?: number
  /** Vector dominance tolerance; positive values are incompatible with scheduler execution. */
  readonly epsilon?: number
  /** Schedule advanced after a failed objective attempt; omission uses the package backoff schedule. */
  readonly retrySchedule?: RetrySchedule
  /** Time limit covering all objective samples and retries for one trial. */
  readonly trialTimeout?: Duration.DurationInput
}> {}

/**
 * Selects direct sampler execution when `sampler` and `trials` are present, or
 * bracket execution when `scheduler` is present.
 *
 * @typeParam Config - Decoded search-space configuration passed to the objective.
 * @typeParam Space - Compiled search space retained by either plan form.
 *
 * @since 0.1.0
 * @category type-level
 */
export type OptimizeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = FlatOptimizeOptions<Config, Space> | ScheduledOptimizeOptions<Config, Space>

/**
 * Infers the objective callback's configuration and result trial configuration
 * from the supplied search space.
 *
 * @typeParam Space - Compiled search space supplying the decoded configuration type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type OptimizeOptionsFromSpace<Space extends SearchSpace.SearchSpace> = OptimizeOptions<
  SearchSpace.Type<Space>,
  Space
>

/**
 * Configures additional flat-sampler work after recovered history. Resume does
 * not accept warm-start trials because the snapshot supplies prior state.
 *
 * @typeParam Config - Decoded search-space configuration passed to the objective.
 * @typeParam Space - Compiled search space checked against recovered metadata.
 *
 * @since 0.1.0
 * @category type-level
 */
export class ResumeOptionFields<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  /** Compiled space checked against the recovered study metadata. */
  readonly space: Space
  /** Sampler restored from the saved checkpoint when one is present. */
  readonly sampler: Sampler.Sampler
  /** Effectful evaluation invoked for newly suggested configurations. */
  readonly objective: ObjectiveFunction<Config>
  /** Scalar comparison direction; omission resolves to `"minimize"`. */
  readonly direction?: Direction
  /** Ordered directions for vector coordinates; a non-empty array takes precedence over `direction`. */
  readonly directions?: ReadonlyArray<Direction>
  /** Policy consulted for intermediate values reported by new trials. */
  readonly pruningPolicy?: PruningPolicy
  /** Cooperative stop behavior; omission resolves to `"Drain"`. */
  readonly stopMode?: StopMode
  /** Non-negative number of trials added after recovered history. */
  readonly trials: number
  /** Positive maximum number of active trial evaluations; omission resolves to one. */
  readonly concurrency?: number
  /** Non-negative cumulative limit applied to recovered and newly reported cost. */
  readonly maxCost?: number
  /** Positive number of objective samples averaged per new trial; omission resolves to one. */
  readonly evaluationsPerTrial?: number
  /** Elapsed-time limit for the resumed execution. */
  readonly maxDuration?: Duration.DurationInput
  /** Finite scalar value that stops admission once reached in the selected direction. */
  readonly targetValue?: number
  /** Positive number of completed scalar trials allowed without a new best value. */
  readonly noImprovementWindow?: number
  /** Non-negative vector dominance tolerance; omission resolves to zero. */
  readonly epsilon?: number
  /** Schedule advanced after a failed objective attempt; omission uses the package backoff schedule. */
  readonly retrySchedule?: RetrySchedule
  /** Time limit covering all objective samples and retries for one new trial. */
  readonly trialTimeout?: Duration.DurationInput
}> {}

/**
 * Continues from an in-memory {@link StudySnapshot}. `trials` counts newly
 * scheduled trials and does not include records already stored in the snapshot.
 *
 * @typeParam Config - Decoded search-space configuration passed to the objective.
 * @typeParam Space - Compiled search space checked against snapshot metadata.
 *
 * @since 0.1.0
 * @category type-level
 */
export class ResumeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<
  ResumeOptionFields<Config, Space> & {
    /** In-memory history and continuation metadata used to seed execution. */
    readonly snapshot: StudySnapshot
  }
> {}

/**
 * Continues from the latest snapshot and replay tail loaded through
 * `StudyStorage`. The returned execution API retains `StudyStorage` as an Effect
 * requirement.
 *
 * @typeParam Config - Decoded search-space configuration passed to the objective.
 * @typeParam Space - Compiled search space checked against persisted metadata.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResumeFromStorageOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> = ResumeOptionFields<Config, Space>

/**
 * Infers resumed objective and trial configuration types from the search space.
 *
 * @typeParam Space - Compiled search space supplying the decoded configuration type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResumeOptionsFromSpace<Space extends SearchSpace.SearchSpace> = ResumeOptions<
  SearchSpace.Type<Space>,
  Space
>

/**
 * Infers storage-resumed objective and trial configuration types from the
 * search space.
 *
 * @typeParam Space - Compiled search space supplying the decoded configuration type.
 *
 * @since 0.1.0
 * @category type-level
 */
export type ResumeFromStorageOptionsFromSpace<Space extends SearchSpace.SearchSpace> = ResumeFromStorageOptions<
  SearchSpace.Type<Space>,
  Space
>

/**
 * Uses an optimization plan as the source for default resolution and validation.
 *
 * @typeParam Config - Decoded configuration retained by the plan.
 * @typeParam Space - Compiled search space retained by the plan.
 *
 * @since 0.1.0
 * @category type-level
 */
export type OptimizeSettingsSource<Config, Space extends SearchSpace.SearchSpace> = OptimizePlan<Config, Space>
