/**
 * Scheduler model for bracketed multi-fidelity optimization.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import type * as Sampler from "../Sampler/index.js"

/**
 * Runtime schema for decoding and validating scheduler mode.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SchedulerModeSchema = Schema.Literal("hyperband", "bohb")

/**
 * The Hyperband or BOHB algorithm represented by a scheduler.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SchedulerMode = Schema.Schema.Type<typeof SchedulerModeSchema>

/**
 * A successive-halving round specifying its configuration count and resource budget.
 *
 * @since 0.1.0
 * @category models
 */
export class Round extends Data.Class<{
  readonly nConfigs: number
  readonly resource: number
}> {}

/**
 * A Hyperband bracket containing its initial allocation and successive-halving rounds.
 *
 * @since 0.1.0
 * @category models
 */
export class Bracket extends Data.Class<{
  readonly index: number
  readonly configs: number
  readonly minResource: number
  readonly rounds: ReadonlyArray<Round>
}> {}

/**
 * A multi-fidelity scheduling topology and sampler used by Hyperband or BOHB.
 *
 * @since 0.1.0
 * @category models
 */
export class Scheduler extends Data.Class<{
  readonly mode: SchedulerMode
  readonly maxResource: number
  readonly reductionFactor: number
  readonly sampler: Sampler.Sampler
  readonly brackets: ReadonlyArray<Bracket>
  readonly randomFraction?: number
  readonly minObservations?: number
  readonly seed?: number
}> {}

/**
 * Observed completion and best-value statistics for a scheduler round.
 *
 * @since 0.1.0
 * @category models
 */
export class RoundSummary extends Data.Class<{
  readonly bracketIndex: number
  readonly roundIndex: number
  readonly nConfigs: number
  readonly resource: number
  readonly completed: number
  readonly bestValue?: number
}> {}

/**
 * Observed round summaries for one scheduler bracket.
 *
 * @since 0.1.0
 * @category models
 */
export class BracketSummary extends Data.Class<{
  readonly bracketIndex: number
  readonly rounds: ReadonlyArray<RoundSummary>
}> {}

/**
 * Execution summary for all brackets in a multi-fidelity scheduler.
 *
 * @since 0.1.0
 * @category models
 */
export class SchedulerSummary extends Data.Class<{
  readonly mode: SchedulerMode
  readonly brackets: ReadonlyArray<BracketSummary>
}> {}

/**
 * Counts the configurations allocated across every round of a scheduler.
 *
 * @since 0.1.0
 * @category utils
 */
export const totalTrials = (scheduler: Scheduler): number =>
  scheduler.brackets.reduce(
    (total, bracket) => total + bracket.rounds.reduce((roundTotal, round) => roundTotal + round.nConfigs, 0),
    0
  )
