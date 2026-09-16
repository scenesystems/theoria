/**
 * Executes, streams, and manually coordinates optimizations.
 *
 * @since 0.7.0
 * @module
 */
import type * as Journal from "@scenesystems/effect-study/Journal"
import type * as Stop from "@scenesystems/effect-study/Stop"
import { Data, Match, Schema } from "effect"
import type { Duration, Effect, Schedule, Stream } from "effect"

import type { Direction } from "./Direction.js"
import * as askTell from "./internal/optimization/askTell.js"
import * as resultOperations from "./internal/optimization/result.js"
import * as execute from "./internal/optimization/run.js"
import * as streams from "./internal/optimization/stream.js"
import { Value } from "./Objective.js"
import type * as OptimizationEvent from "./OptimizationEvent.js"
import type * as OptimizationSnapshot from "./OptimizationSnapshot.js"
import type * as Pruning from "./Pruning.js"
import type * as Sampler from "./Sampler.js"
import type * as Scheduler from "./Scheduler.js"
import type { SearchError } from "./SearchError.js"
import type * as SearchSpace from "./SearchSpace.js"
import type * as Trial from "./Trial.js"

/** Objective result with an optional caller-defined cost. @since 0.7.0 @category schemas */
export class ObjectiveReport extends Schema.Class<ObjectiveReport>("effect-search/Optimization/ObjectiveReport")({
  value: Value,
  cost: Schema.optional(Schema.Number)
}) {}

/** Value accepted from objective callbacks. @since 0.7.0 @category schemas */
export const ObjectiveResult = Schema.Union(Value, ObjectiveReport)
/** @since 0.7.0 @category models */
export type ObjectiveResult = typeof ObjectiveResult.Type

/** Effectful objective evaluation. @since 0.7.0 @category models */
export type Objective<Config = unknown, E = unknown, R = never> = (
  config: Config,
  runtime: Pruning.Runtime
) => Effect.Effect<ObjectiveResult, E, R>

/** One completed warm-start observation. @since 0.7.0 @category models */
export class PriorTrial<Config = unknown> extends Data.Class<{
  readonly config: Config
  readonly value: Value
  readonly cost?: number
}> {}

/** Retry policy for objective failures. @since 0.7.0 @category models */
export type RetrySchedule = Schedule.Schedule<unknown, unknown, never>

/** Direct sampler optimization options. @since 0.7.0 @category models */
export class FlatOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly objective: Objective<Config>
  readonly trials: number
  readonly direction?: Direction
  readonly directions?: Iterable<Direction>
  readonly pruningPolicy?: Pruning.Policy
  readonly stopMode?: Stop.Mode
  readonly concurrency?: number
  readonly priorTrials?: Iterable<PriorTrial<Config>>
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

/** Bracket scheduler optimization options. @since 0.7.0 @category models */
export class ScheduledOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  readonly space: Space
  readonly scheduler: Scheduler.Plan
  readonly objective: Objective<Config>
  readonly direction?: Direction
  readonly directions?: Iterable<Direction>
  readonly pruningPolicy?: Pruning.Policy
  readonly stopMode?: Stop.Mode
  readonly concurrency?: number
  readonly priorTrials?: Iterable<PriorTrial<Config>>
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

/** Fresh optimization options. @since 0.7.0 @category models */
export type Options<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> =
  | FlatOptions<Config, Space>
  | ScheduledOptions<Config, Space>

/** Snapshot continuation options. @since 0.7.0 @category models */
export class ResumeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly snapshot: OptimizationSnapshot.OptimizationSnapshot
  readonly objective: Objective<Config>
  readonly trials: number
  readonly direction?: Direction
  readonly directions?: Iterable<Direction>
  readonly pruningPolicy?: Pruning.Policy
  readonly stopMode?: Stop.Mode
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

/** Storage continuation options omit the snapshot loaded by the service. @since 0.7.0 @category models */
export class StorageResumeOptions<
  Config = unknown,
  Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace
> extends Data.Class<{
  readonly space: Space
  readonly sampler: Sampler.Sampler
  readonly objective: Objective<Config>
  readonly trials: number
  readonly direction?: Direction
  readonly directions?: Iterable<Direction>
  readonly pruningPolicy?: Pruning.Policy
  readonly stopMode?: Stop.Mode
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

/**
 * Manual ask/tell capability bound to its opening Scope. Operations retain the
 * private runtime in closures; callers never need its queues or mutable state.
 *
 * @since 0.7.0
 * @category models
 */
export class Optimization<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace>
  extends Data.TaggedClass("effect-search/Optimization")<{
    readonly ask: Effect.Effect<AskedTrial<SearchSpace.Type<Space>>, SearchError>
    readonly tell: (trialNumber: number, value: Value) => Effect.Effect<void, SearchError>
    readonly fail: (trialNumber: number, cause: unknown) => Effect.Effect<void, SearchError>
    readonly cancel: Effect.Effect<void, Journal.Failure>
    readonly events: Stream.Stream<OptimizationEvent.OptimizationEvent>
    readonly result: Effect.Effect<Result<SearchSpace.Type<Space>>, SearchError>
    readonly snapshot: Effect.Effect<OptimizationSnapshot.OptimizationSnapshot, SearchError>
  }>
{}

/** Configuration reserved for external evaluation. @since 0.7.0 @category models */
export class AskedTrial<Config = unknown> extends Data.Class<{
  readonly trialNumber: number
  readonly config: Config
}> {}

/** Scalar optimization result. @since 0.7.0 @category models */
export class SingleObjectiveResult<Config = unknown> extends Data.TaggedClass("SingleObjective")<{
  readonly snapshotMetadata: OptimizationSnapshot.Metadata
  readonly bestTrial: Trial.NumericCompletedTrial<Config>
  readonly trials: Iterable<Trial.Trial<Config>>
  readonly completionReason: OptimizationEvent.CompletionReason
  readonly schedulerSummary?: Scheduler.Summary
}> {}

/** Multi-objective optimization result. @since 0.7.0 @category models */
export class MultiObjectiveResult<Config = unknown> extends Data.TaggedClass("MultiObjective")<{
  readonly snapshotMetadata: OptimizationSnapshot.Metadata
  readonly paretoFront: Iterable<Trial.CompletedTrial<Config>>
  readonly trials: Iterable<Trial.Trial<Config>>
  readonly completionReason: OptimizationEvent.CompletionReason
  readonly schedulerSummary?: Scheduler.Summary
}> {}

/** Terminal optimization result. @since 0.7.0 @category models */
export type Result<Config = unknown> = SingleObjectiveResult<Config> | MultiObjectiveResult<Config>

/** Recognizes a manual optimization handle. @since 0.7.0 @category guards */
export const isOptimization = Schema.is(Schema.instanceOf(Optimization))

/** Executes an optimization. @since 0.7.0 @category combinators */
export const run = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => execute.run(options)
/** Executes a scalar minimization optimization. @since 0.7.0 @category combinators */
export const minimize = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => execute.run({ ...options, direction: "minimize" })
/** Executes a scalar maximization optimization. @since 0.7.0 @category combinators */
export const maximize = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => execute.run({ ...options, direction: "maximize" })
/** Continues an in-memory snapshot. @since 0.7.0 @category combinators */
export const resume = <Space extends SearchSpace.SearchSpace>(
  options: ResumeOptions<SearchSpace.Type<Space>, Space>
) => execute.resume(options)
/** Continues from ambient durable storage. @since 0.7.0 @category combinators */
export const resumeFromStorage = <Space extends SearchSpace.SearchSpace>(
  options: StorageResumeOptions<SearchSpace.Type<Space>, Space>
) => execute.resumeFromStorage(options)
/** Streams events from a fresh optimization. @since 0.7.0 @category combinators */
export const stream = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => streams.stream(options)
/** Streams events while continuing a snapshot. @since 0.7.0 @category combinators */
export const resumeStream = <Space extends SearchSpace.SearchSpace>(
  options: ResumeOptions<SearchSpace.Type<Space>, Space>
) => streams.resumeStream(options)
/** Streams events while continuing durable state. @since 0.7.0 @category combinators */
export const resumeFromStorageStream = <Space extends SearchSpace.SearchSpace>(
  options: StorageResumeOptions<SearchSpace.Type<Space>, Space>
) => streams.resumeFromStorageStream(options)

/** Opens a scoped manual optimization. @since 0.7.0 @category combinators */
export const open = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => askTell.open(options)
/** Reserves a configuration. @since 0.7.0 @category combinators */
export const ask = <Space extends SearchSpace.SearchSpace>(self: Optimization<Space>) => self.ask
/** Records a successful external evaluation. @since 0.7.0 @category combinators */
export const tell = <Space extends SearchSpace.SearchSpace>(
  self: Optimization<Space>,
  trialNumber: number,
  value: Value
) => self.tell(trialNumber, value)
/** Records a failed external evaluation. @since 0.7.0 @category combinators */
export const fail = <Space extends SearchSpace.SearchSpace>(
  self: Optimization<Space>,
  trialNumber: number,
  cause: unknown
) => self.fail(trialNumber, cause)
/** Cancels a manual optimization. @since 0.7.0 @category combinators */
export const cancel = <Space extends SearchSpace.SearchSpace>(self: Optimization<Space>) => self.cancel
/** Streams events from a manual optimization. @since 0.7.0 @category combinators */
export const events: <Space extends SearchSpace.SearchSpace>(
  self: Optimization<Space>
) => Stream.Stream<OptimizationEvent.OptimizationEvent> = (self) => self.events
/** Builds the terminal result of a closed manual optimization. @since 0.7.0 @category combinators */
export const result = <Space extends SearchSpace.SearchSpace>(self: Optimization<Space>) => self.result
/** Captures an immutable result. @since 0.7.0 @category combinators */
export function snapshot<Config>(value: Result<Config>): Effect.Effect<OptimizationSnapshot.OptimizationSnapshot>
/** Captures an active manual optimization. @since 0.7.0 @category combinators */
export function snapshot<Space extends SearchSpace.SearchSpace>(
  value: Optimization<Space>
): Effect.Effect<OptimizationSnapshot.OptimizationSnapshot, SearchError>
export function snapshot<Config, Space extends SearchSpace.SearchSpace>(
  value: Result<Config> | Optimization<Space>
): Effect.Effect<OptimizationSnapshot.OptimizationSnapshot, SearchError> {
  return Match.value(value).pipe(
    Match.tagsExhaustive({
      "effect-search/Optimization": (self) => self.snapshot,
      SingleObjective: execute.snapshot,
      MultiObjective: execute.snapshot
    })
  )
}
/** Returns a result's Pareto projection. @since 0.7.0 @category combinators */
export const pareto = <Config>(optimizationResult: Result<Config>) => resultOperations.pareto(optimizationResult)
