/**
 * Validated plan records and resolved runtime settings.
 *
 * @since 0.1.0
 */
import type { Duration } from "effect"
import { Data, Option, Schedule, Schema } from "effect"

import type { Direction } from "../../contracts/Direction.js"
import { ObjectiveSpecSchema } from "../../contracts/ObjectiveSpec.js"
import type { ObjectiveValue } from "../../contracts/ObjectiveValue.js"
import type * as Sampler from "../../Sampler/index.js"
import type * as Scheduler from "../../Scheduler/index.js"
import type * as SearchSpace from "../../SearchSpace/index.js"
import { type ObjectiveFunction } from "../objectiveEvaluator.js"
import type { PruningPolicy, StopMode } from "../runtime/pruning.js"
import { StopModeSchema } from "../runtime/pruning.js"
import { type StudySnapshot } from "../snapshot/versioning.js"
import { EpsilonRuntimeSchema, RetryScheduleRuntimeSchema } from "./schema.js"

/**
 * Retries failed objective attempts according to Effect `Schedule` recurrences.
 * Exhausting the schedule leaves the objective failure on the trial.
 *
 * @since 0.1.0
 * @category type-level
 */
export type RetrySchedule = Schedule.Schedule<unknown, unknown, never>

const retryScheduleDefault = (): RetrySchedule =>
  Schedule.exponential("100 millis").pipe(Schedule.intersect(Schedule.recurs(3)), Schedule.jittered)

/**
 * Unwraps an optional retry schedule, falling back to a jittered exponential backoff with 3 retries.
 *
 * @since 0.1.0
 * @category utils
 */
export const retryScheduleOrDefault = (
  retrySchedule: Option.Option<RetrySchedule>
): RetrySchedule => Option.getOrElse(retrySchedule, retryScheduleDefault)

/**
 * Seeds sampler history with a completed result that does not consume the fresh
 * trial count. Configuration decoding, objective arity, finiteness, and optional
 * non-negative cost are validated before execution. Runtime trials created from
 * these values are marked `prior` and receive negative trial numbers.
 *
 * @typeParam Config - Decoded search-space configuration supplied as prior history.
 *
 * @since 0.1.0
 * @category type-level
 */
export class PriorTrial<Config = unknown> extends Data.Class<{
  /** Configuration decoded against the current search-space schema. */
  readonly config: Config
  /** Scalar or vector result compatible with the current objective specification. */
  readonly value: ObjectiveValue
  /** Optional finite, non-negative cost included in initial cumulative cost. */
  readonly cost?: number
}> {}

/**
 * Stores defaults resolved from an optimization plan. Direct construction checks
 * schema shape only; call {@link validateSettings} before using custom values for
 * execution.
 *
 * @remarks
 * Trial count is a non-negative integer. Concurrency and evaluations per trial
 * are positive integers. Prior weight, epsilon, and optional cost budget are
 * finite and non-negative. Target values must be finite, and no-improvement
 * windows are positive integers.
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizeSettings extends Schema.Class<OptimizeSettings>("effect-search/OptimizeSettings")({
  /** Scalar or vector objective shape resolved from the direction options. */
  objectiveSpec: ObjectiveSpecSchema,
  /** Number of fresh trials admitted by this execution. */
  trials: Schema.Number,
  /** Maximum number of trial evaluations that may be active at once. */
  concurrency: Schema.Number,
  /** Behavior exposed to active objectives after a trial requests termination. */
  stopMode: StopModeSchema,
  /** Relative observation weight assigned to each warm-start trial. */
  priorWeight: Schema.Number,
  /** Optional cumulative cost limit in the units reported by the objective. */
  maxCost: Schema.optional(Schema.Number),
  /** Objective samples averaged into each trial result. */
  evaluationsPerTrial: Schema.Number,
  /** Optional elapsed-time limit for the whole execution. */
  maxDuration: Schema.optional(Schema.DurationFromSelf),
  /** Scalar objective value that ends admission once reached. */
  targetValue: Schema.optional(Schema.Number),
  /** Completed scalar trials allowed without an improvement. */
  noImprovementWindow: Schema.optional(Schema.Number),
  /** Dominance tolerance used by vector objectives. */
  epsilon: EpsilonRuntimeSchema,
  /** Schedule advanced after each failed objective attempt. */
  retrySchedule: RetryScheduleRuntimeSchema,
  /** Optional time limit covering all samples and retries for one trial. */
  trialTimeout: Schema.optional(Schema.DurationFromSelf)
}) {}

/**
 * Preserves structurally validated fresh-study options for later default
 * resolution and semantic validation. Scheduled plans copy their scheduler's
 * sampler and computed total trial count. Constructing the class directly does
 * not validate any field.
 *
 * @typeParam Config - Decoded search-space configuration passed to the objective.
 * @typeParam Space - Compiled search space retained for result inference.
 *
 * @since 0.1.0
 * @category models
 */
export class OptimizePlan<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  /** Compiled space used to decode each suggested configuration. */
  readonly space: Space
  /** Sampler used directly or selected from `scheduler`. */
  readonly sampler: Sampler.Sampler
  /** Optional bracket and resource schedule that determined the trial count. */
  readonly scheduler?: Scheduler.Scheduler
  /** Effectful evaluation invoked with decoded configurations. */
  readonly objective: ObjectiveFunction<Config>
  /** Scalar comparison direction when `directions` does not select a vector objective. */
  readonly direction?: Direction
  /** Ordered comparison directions for vector objective coordinates. */
  readonly directions?: ReadonlyArray<Direction>
  /** Policy consulted when an objective reports an intermediate value. */
  readonly pruningPolicy?: PruningPolicy
  /** Cooperative stop behavior; omission resolves to `"Drain"`. */
  readonly stopMode?: StopMode
  /** Number of fresh trials, or the scheduler's computed total. */
  readonly trials: number
  /** Maximum active trial evaluations; omission resolves to one. */
  readonly concurrency?: number
  /** Completed observations inserted before fresh sampling begins. */
  readonly priorTrials?: ReadonlyArray<PriorTrial<Config>>
  /** Weight assigned to each prior observation; omission resolves to one. */
  readonly priorWeight?: number
  /** Cumulative objective-reported cost limit for admitting fresh work. */
  readonly maxCost?: number
  /** Objective samples averaged per trial; omission resolves to one. */
  readonly evaluationsPerTrial?: number
  /** Elapsed-time limit for the study execution. */
  readonly maxDuration?: Duration.DurationInput
  /** Scalar value that stops admission once reached in the selected direction. */
  readonly targetValue?: number
  /** Completed scalar trials allowed without a new best value. */
  readonly noImprovementWindow?: number
  /** Vector dominance tolerance; omission resolves to zero. */
  readonly epsilon?: number
  /** Failure retry schedule; omission uses the package backoff schedule. */
  readonly retrySchedule?: RetrySchedule
  /** Time limit covering all objective samples and retries for one trial. */
  readonly trialTimeout?: Duration.DurationInput
}> {}

/**
 * Preserves structurally validated continuation options and their in-memory
 * snapshot. Snapshot compatibility and sampler checkpoint restoration occur
 * when execution builds its resume seed.
 *
 * @typeParam Config - Decoded search-space configuration passed to the objective.
 * @typeParam Space - Compiled search space retained for continued result inference.
 *
 * @since 0.1.0
 * @category models
 */
export class ResumePlan<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  /** Compiled space checked against the recovered study metadata. */
  readonly space: Space
  /** Sampler restored from the snapshot checkpoint when one is present. */
  readonly sampler: Sampler.Sampler
  /** In-memory history and continuation metadata used to seed execution. */
  readonly snapshot: StudySnapshot
  /** Effectful evaluation invoked for newly suggested configurations. */
  readonly objective: ObjectiveFunction<Config>
  /** Scalar comparison direction when `directions` does not select a vector objective. */
  readonly direction?: Direction
  /** Ordered comparison directions for vector objective coordinates. */
  readonly directions?: ReadonlyArray<Direction>
  /** Policy consulted for intermediate values reported by new trials. */
  readonly pruningPolicy?: PruningPolicy
  /** Cooperative stop behavior; omission resolves to `"Drain"`. */
  readonly stopMode?: StopMode
  /** Number of trials added after the recovered history. */
  readonly trials: number
  /** Maximum active trial evaluations; omission resolves to one. */
  readonly concurrency?: number
  /** Cumulative cost limit applied to recovered and newly reported cost. */
  readonly maxCost?: number
  /** Objective samples averaged per new trial; omission resolves to one. */
  readonly evaluationsPerTrial?: number
  /** Elapsed-time limit for the resumed execution. */
  readonly maxDuration?: Duration.DurationInput
  /** Scalar value that stops admission once reached in the selected direction. */
  readonly targetValue?: number
  /** Completed scalar trials allowed without a new best value. */
  readonly noImprovementWindow?: number
  /** Vector dominance tolerance; omission resolves to zero. */
  readonly epsilon?: number
  /** Failure retry schedule; omission uses the package backoff schedule. */
  readonly retrySchedule?: RetrySchedule
  /** Time limit covering all objective samples and retries for one new trial. */
  readonly trialTimeout?: Duration.DurationInput
}> {}
