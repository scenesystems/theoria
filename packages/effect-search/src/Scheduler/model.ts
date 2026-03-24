/**
 * Scheduler model for bracketed multi-fidelity optimization.
 *
 * @since 0.1.0
 */
import { Data, Schema } from "effect"

import type * as Sampler from "../Sampler/index.js"

/**
 * @since 0.1.0
 * @category schemas
 */
export const SchedulerModeSchema = Schema.Literal("hyperband", "bohb")

/**
 * @since 0.1.0
 * @category type-level
 */
export type SchedulerMode = Schema.Schema.Type<typeof SchedulerModeSchema>

/**
 * @since 0.1.0
 * @category models
 */
export class Round extends Data.Class<{
  readonly nConfigs: number
  readonly resource: number
}> {}

/**
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
 * @since 0.1.0
 * @category models
 */
export class BracketSummary extends Data.Class<{
  readonly bracketIndex: number
  readonly rounds: ReadonlyArray<RoundSummary>
}> {}

/**
 * @since 0.1.0
 * @category models
 */
export class SchedulerSummary extends Data.Class<{
  readonly mode: SchedulerMode
  readonly brackets: ReadonlyArray<BracketSummary>
}> {}

/**
 * @since 0.1.0
 * @category utils
 */
export const totalTrials = (scheduler: Scheduler): number =>
  scheduler.brackets.reduce(
    (total, bracket) => total + bracket.rounds.reduce((roundTotal, round) => roundTotal + round.nConfigs, 0),
    0
  )
