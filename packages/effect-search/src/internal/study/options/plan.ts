/**
 * Validated plan records and resolved runtime settings.
 *
 * @since 0.1.0
 */
import type * as Stop from "@scenesystems/effect-study/Stop"
import type { Duration } from "effect"
import { Data, Option, Schedule } from "effect"

import type { Direction } from "../../../Direction.js"
import type { Objective, Value } from "../../../Objective.js"
import type { Policy } from "../../../Pruning.js"
import type * as Sampler from "../../../Sampler.js"
import type * as Scheduler from "../../../Scheduler.js"
import type * as SearchSpace from "../../../SearchSpace.js"
import type { Objective as StudyObjective } from "../../../Study.js"
import type * as StudySnapshot from "../../../StudySnapshot.js"

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
  readonly value: Value
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
export class OptimizeSettings extends Data.Class<{
  readonly objectiveSpec: Objective
  readonly trials: number
  readonly concurrency: number
  readonly stopMode: Stop.Mode
  readonly priorWeight: number
  readonly maxCost?: number
  readonly evaluationsPerTrial: number
  readonly maxDuration?: Duration.Duration
  readonly targetValue?: number
  readonly noImprovementWindow?: number
  readonly epsilon: number
  readonly retrySchedule: RetrySchedule
  readonly trialTimeout?: Duration.Duration
}> {}

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
  readonly scheduler?: Scheduler.Plan
  /** Effectful evaluation invoked with decoded configurations. */
  readonly objective: StudyObjective<Config>
  /** Scalar comparison direction when `directions` does not select a vector objective. */
  readonly direction?: Direction
  /** Ordered comparison directions for vector objective coordinates. */
  readonly directions?: Iterable<Direction>
  /** Policy consulted when an objective reports an intermediate value. */
  readonly pruningPolicy?: Policy
  /** Cooperative stop behavior; omission resolves to `"Drain"`. */
  readonly stopMode?: Stop.Mode
  /** Number of fresh trials, or the scheduler's computed total. */
  readonly trials: number
  /** Maximum active trial evaluations; omission resolves to one. */
  readonly concurrency?: number
  /** Completed observations inserted before fresh sampling begins. */
  readonly priorTrials?: Iterable<PriorTrial<Config>>
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
  readonly snapshot: StudySnapshot.Snapshot
  /** Effectful evaluation invoked for newly suggested configurations. */
  readonly objective: StudyObjective<Config>
  /** Scalar comparison direction when `directions` does not select a vector objective. */
  readonly direction?: Direction
  /** Ordered comparison directions for vector objective coordinates. */
  readonly directions?: Iterable<Direction>
  /** Policy consulted for intermediate values reported by new trials. */
  readonly pruningPolicy?: Policy
  /** Cooperative stop behavior; omission resolves to `"Drain"`. */
  readonly stopMode?: Stop.Mode
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
