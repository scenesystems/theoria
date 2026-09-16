/**
 * Executes, streams, and manually coordinates optimization studies.
 *
 * @since 0.7.0
 * @module
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import { Data, Effect as EffectRuntime, Match, Option, Schema } from "effect"
import type { Duration, Effect, Schedule, Stream } from "effect"

import type { Direction } from "./Direction.js"
import * as askTell from "./internal/study/askTell.js"
import * as askTellResult from "./internal/study/askTellResult.js"
import * as askTellSnapshot from "./internal/study/askTellSnapshot.js"
import type { HandleRuntime } from "./internal/study/askTellState.js"
import * as execute from "./internal/study/optimize.js"
import * as resultOperations from "./internal/study/result.js"
import * as streams from "./internal/study/stream.js"
import { Value } from "./Objective.js"
import type * as Pruning from "./Pruning.js"
import type * as Sampler from "./Sampler.js"
import type * as Scheduler from "./Scheduler.js"
import type { SearchError } from "./SearchError.js"
import type * as SearchSpace from "./SearchSpace.js"
import type * as StudyEvent from "./StudyEvent.js"
import type * as StudySnapshot from "./StudySnapshot.js"
import type * as Trial from "./Trial.js"

/** Objective result with an optional caller-defined cost. @since 0.7.0 @category schemas */
export class ObjectiveReport extends Schema.Class<ObjectiveReport>("effect-search/Study/ObjectiveReport")({
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

/** Direct sampler study options. @since 0.7.0 @category models */
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

/** Bracket scheduler study options. @since 0.7.0 @category models */
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

/** Fresh study options. @since 0.7.0 @category models */
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
  readonly snapshot: StudySnapshot.StudySnapshot
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

/** Manual ask/tell study bound to its opening Scope. @since 0.7.0 @category models */
export class Study<Space extends SearchSpace.SearchSpace = SearchSpace.SearchSpace>
  extends Data.TaggedClass("effect-search/Study")<{
    readonly runtime: HandleRuntime<Space>
  }>
{}

/** Configuration reserved for external evaluation. @since 0.7.0 @category models */
export class AskedTrial<Config = unknown> extends Data.Class<{
  readonly trialNumber: number
  readonly config: Config
}> {}

/** Scalar study result. @since 0.7.0 @category models */
export class SingleObjectiveResult<Config = unknown> extends Data.TaggedClass("SingleObjective")<{
  readonly snapshotMetadata: StudySnapshot.Metadata
  readonly bestTrial: Trial.NumericCompletedTrial<Config>
  readonly trials: Iterable<Trial.Trial<Config>>
  readonly completionReason: StudyEvent.CompletionReason
  readonly schedulerSummary?: Scheduler.Summary
}> {}

/** Multi-objective study result. @since 0.7.0 @category models */
export class MultiObjectiveResult<Config = unknown> extends Data.TaggedClass("MultiObjective")<{
  readonly snapshotMetadata: StudySnapshot.Metadata
  readonly paretoFront: Iterable<Trial.CompletedTrial<Config>>
  readonly trials: Iterable<Trial.Trial<Config>>
  readonly completionReason: StudyEvent.CompletionReason
  readonly schedulerSummary?: Scheduler.Summary
}> {}

/** Terminal result of a study. @since 0.7.0 @category models */
export type Result<Config = unknown> = SingleObjectiveResult<Config> | MultiObjectiveResult<Config>

/** Recognizes a manual study handle. @since 0.7.0 @category guards */
export const isStudy = Schema.is(Schema.instanceOf(Study))
const isResult = <Config, Space extends SearchSpace.SearchSpace>(
  value: Result<Config> | Study<Space>
): value is Result<Config> =>
  Match.value(value).pipe(
    Match.tag("SingleObjective", () => true),
    Match.tag("MultiObjective", () => true),
    Match.orElse(() => false)
  )

/** Executes a study. @since 0.7.0 @category combinators */
export const optimize = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => execute.optimize(options)
/** Executes a scalar minimization study. @since 0.7.0 @category combinators */
export const minimize = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => execute.optimize({ ...options, direction: "minimize" })
/** Executes a scalar maximization study. @since 0.7.0 @category combinators */
export const maximize = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => execute.optimize({ ...options, direction: "maximize" })
/** Continues an in-memory snapshot. @since 0.7.0 @category combinators */
export const resume = <Space extends SearchSpace.SearchSpace>(
  options: ResumeOptions<SearchSpace.Type<Space>, Space>
) => execute.resume(options)
/** Continues from ambient durable storage. @since 0.7.0 @category combinators */
export const resumeFromStorage = <Space extends SearchSpace.SearchSpace>(
  options: StorageResumeOptions<SearchSpace.Type<Space>, Space>
) => execute.resumeFromStorage(options)
/** Streams events from a fresh study. @since 0.7.0 @category combinators */
export const optimizeStream = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => streams.optimizeStream(options)
/** Streams events while continuing a snapshot. @since 0.7.0 @category combinators */
export const resumeStream = <Space extends SearchSpace.SearchSpace>(
  options: ResumeOptions<SearchSpace.Type<Space>, Space>
) => streams.resumeStream(options)
/** Streams events while continuing durable state. @since 0.7.0 @category combinators */
export const resumeFromStorageStream = <Space extends SearchSpace.SearchSpace>(
  options: StorageResumeOptions<SearchSpace.Type<Space>, Space>
) => streams.resumeFromStorageStream(options)

/** Opens a scoped manual study. @since 0.7.0 @category combinators */
export const open = <Space extends SearchSpace.SearchSpace>(
  options: Options<SearchSpace.Type<Space>, Space>
) => askTell.open(options)
/** Reserves a configuration. @since 0.7.0 @category combinators */
export const ask = <Space extends SearchSpace.SearchSpace>(study: Study<Space>) => askTell.ask(study)
/** Records a successful external evaluation. @since 0.7.0 @category combinators */
export const tell = <Space extends SearchSpace.SearchSpace>(study: Study<Space>, trialNumber: number, value: Value) =>
  askTell.tell(study, trialNumber, value)
/** Records a failed external evaluation. @since 0.7.0 @category combinators */
export const fail = <Space extends SearchSpace.SearchSpace>(study: Study<Space>, trialNumber: number, cause: unknown) =>
  askTell.fail(study, trialNumber, cause)
/** Cancels a manual study. @since 0.7.0 @category combinators */
export const cancel = <Space extends SearchSpace.SearchSpace>(study: Study<Space>) => askTell.cancel(study)
/** Streams events from a manual study. @since 0.7.0 @category combinators */
export const events: <Space extends SearchSpace.SearchSpace>(
  study: Study<Space>
) => Stream.Stream<StudyEvent.StudyEvent> = (
  study
) => askTellResult.events(study)
/** Builds the terminal result of a closed manual study. @since 0.7.0 @category combinators */
export const result = <Space extends SearchSpace.SearchSpace>(study: Study<Space>) => askTellResult.result(study)
/** Captures an immutable result. @since 0.7.0 @category combinators */
export function snapshot<Config>(value: Result<Config>): Effect.Effect<StudySnapshot.StudySnapshot>
/** Captures an active manual study. @since 0.7.0 @category combinators */
export function snapshot<Space extends SearchSpace.SearchSpace>(
  value: Study<Space>
): Effect.Effect<StudySnapshot.StudySnapshot, SearchError>
export function snapshot<Config, Space extends SearchSpace.SearchSpace>(
  value: Result<Config> | Study<Space>
): Effect.Effect<StudySnapshot.StudySnapshot, SearchError> {
  return Option.liftPredicate(value, isStudy).pipe(
    Option.match({
      onSome: askTellSnapshot.snapshotStudy,
      onNone: () =>
        Option.liftPredicate(value, isResult).pipe(
          Option.match({
            onSome: execute.snapshot,
            onNone: () => EffectRuntime.dieMessage("Unrecognized study snapshot source")
          })
        )
    })
  )
}
/** Returns a result's Pareto projection. @since 0.7.0 @category combinators */
export const pareto = <Config>(studyResult: Result<Config>) => resultOperations.pareto(studyResult)
