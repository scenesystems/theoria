/**
 * Core data models for optimization plans, resume plans, and study settings.
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
 * Prior completed trial used to warm-start optimization.
 *
 * @since 0.1.0
 * @category type-level
 */
export class PriorTrial<Config = unknown> extends Data.Class<{
  readonly config: Config
  readonly value: ObjectiveValue
  readonly cost?: number
}> {}

/**
 * @since 0.1.0
 * @category models
 */
export class OptimizeSettings extends Schema.Class<OptimizeSettings>("effect-search/OptimizeSettings")({
  objectiveSpec: ObjectiveSpecSchema,
  trials: Schema.Number,
  concurrency: Schema.Number,
  stopMode: StopModeSchema,
  priorWeight: Schema.Number,
  maxCost: Schema.optional(Schema.Number),
  evaluationsPerTrial: Schema.Number,
  maxDuration: Schema.optional(Schema.DurationFromSelf),
  targetValue: Schema.optional(Schema.Number),
  noImprovementWindow: Schema.optional(Schema.Number),
  epsilon: EpsilonRuntimeSchema,
  retrySchedule: RetryScheduleRuntimeSchema,
  trialTimeout: Schema.optional(Schema.DurationFromSelf)
}) {}

/**
 * @since 0.1.0
 * @category models
 */
export class OptimizePlan<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly scheduler?: Scheduler.Scheduler
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
}> {}

/**
 * @since 0.1.0
 * @category models
 */
export class ResumePlan<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly snapshot: StudySnapshot
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
}> {}
