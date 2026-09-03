/**
 * Bracket plans and execution summaries for multi-fidelity studies.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import type * as Sampler from "../Sampler/index.js"

/**
 * Decodes the scheduler algorithms implemented by the Study runtime.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SchedulerModeSchema = Schema.Literal("hyperband", "bohb")

/**
 * Identifies how new configurations are selected within a bracket topology.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SchedulerMode = Schema.Schema.Type<typeof SchedulerModeSchema>

/**
 * Allocates a resource amount to a fixed number of evaluations in one round.
 *
 * @since 0.1.0
 * @category models
 */
export class Round extends Data.Class<{
  /** Planned evaluations before promotion to the next round. */
  readonly nConfigs: number
  /** Resource value exposed through `ObjectiveTrialRuntime.resource`. */
  readonly resource: number
}> {}

/**
 * Defines one independent successive-halving sequence.
 *
 * @since 0.1.0
 * @category models
 */
export class Bracket extends Data.Class<{
  /** Stable identifier emitted in bracket and round events. */
  readonly index: number
  /** Number of configurations suggested before the first round. */
  readonly configs: number
  /** Resource assigned to the first round. */
  readonly minResource: number
  /** Evaluation and promotion stages in execution order. */
  readonly rounds: ReadonlyArray<Round>
}> {}

/**
 * Describes a finite bracket topology and its strategy for new configurations.
 *
 * @remarks
 * Study execution promotes the best completed scalar-objective configurations
 * between rounds and suggests replacements when too few evaluations complete.
 * Multi-objective studies reject scheduler execution.
 *
 * @since 0.1.0
 * @category models
 */
export class Scheduler extends Data.Class<{
  /** Selects Hyperband-only or BOHB suggestion behavior. */
  readonly mode: SchedulerMode
  /** Requested upper resource budget retained for inspection. */
  readonly maxResource: number
  /** Ratio used to reduce counts and increase resource between rounds. */
  readonly reductionFactor: number
  /** Used for Hyperband suggestions and BOHB's model-based suggestions. */
  readonly sampler: Sampler.Sampler
  /** Brackets executed sequentially in array order. */
  readonly brackets: ReadonlyArray<Bracket>
  /** BOHB random-suggestion probability after its initial observation period. */
  readonly randomFraction?: number
  /** BOHB metadata ignored by current Study execution. */
  readonly minObservations?: number
  /** Seed for BOHB exploration decisions and random suggestions. */
  readonly seed?: number
}> {}

/**
 * Reports planned allocation and completed scalar results for one round.
 *
 * @since 0.1.0
 * @category models
 */
export class RoundSummary extends Data.Class<{
  /** Bracket identifier copied from the executed topology. */
  readonly bracketIndex: number
  /** Zero-based position in the bracket's round array. */
  readonly roundIndex: number
  /** Number of evaluations planned for the round. */
  readonly nConfigs: number
  /** Resource supplied to each planned evaluation. */
  readonly resource: number
  /** Evaluations that completed with a numeric scalar objective. */
  readonly completed: number
  /** Direction-aware best value, absent when no numeric objective completed. */
  readonly bestValue?: number
}> {}

/**
 * Collects round outcomes for one completed bracket.
 *
 * @since 0.1.0
 * @category models
 */
export class BracketSummary extends Data.Class<{
  /** Bracket identifier copied from the executed topology. */
  readonly bracketIndex: number
  /** Round outcomes in execution order. */
  readonly rounds: ReadonlyArray<RoundSummary>
}> {}

/**
 * Collects bracket outcomes for a completed scheduled study.
 *
 * @since 0.1.0
 * @category models
 */
export class SchedulerSummary extends Data.Class<{
  /** Scheduler algorithm used for the study. */
  readonly mode: SchedulerMode
  /** Bracket outcomes in execution order. */
  readonly brackets: ReadonlyArray<BracketSummary>
}> {}

/**
 * Sums the planned evaluation count across every round.
 *
 * @remarks
 * The result is the trial budget for uninterrupted execution. Study stopping
 * conditions may produce fewer trials, while failed or pruned evaluations still
 * occupy their planned round slots.
 *
 * @param scheduler - Topology whose round allocations are summed.
 * @since 0.1.0
 * @category combinators
 */
export const totalTrials = (scheduler: Scheduler): number =>
  scheduler.brackets.reduce(
    (total, bracket) => total + bracket.rounds.reduce((roundTotal, round) => roundTotal + round.nConfigs, 0),
    0
  )
