/**
 * Scheduler model for bracketed multi-fidelity optimization.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import type * as Sampler from "../Sampler/index.js"

/**
 * Decodes the two scheduler mode literals, `"hyperband"` and `"bohb"`.
 *
 * @since 0.1.0
 * @category schemas
 */
export const SchedulerModeSchema = Schema.Literal("hyperband", "bohb")

/**
 * A value decoded by {@link SchedulerModeSchema}.
 *
 * @since 0.1.0
 * @category type-level
 */
export type SchedulerMode = Schema.Schema.Type<typeof SchedulerModeSchema>

/**
 * One successive-halving allocation: number of configurations and per-trial resource.
 *
 * @since 0.1.0
 * @category models
 */
export class Round extends Data.Class<{
  readonly nConfigs: number
  readonly resource: number
}> {}

/**
 * A bracket's index, initial allocation, minimum resource, and rounds in
 * execution order.
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
 * A finite bracket/round topology and the sampler used to propose configurations.
 * BOHB additionally records its exploration fraction, observation threshold,
 * and optional seed.
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
 * Observations for one identified round. `bestValue` is absent when no best
 * completed objective value was recorded.
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
 * Sums `nConfigs` over every round in every bracket. This is the finite trial
 * budget consumed when a study executes the complete scheduler topology.
 *
 * @since 0.1.0
 * @category combinators
 */
export const totalTrials = (scheduler: Scheduler): number =>
  scheduler.brackets.reduce(
    (total, bracket) => total + bracket.rounds.reduce((roundTotal, round) => roundTotal + round.nConfigs, 0),
    0
  )
