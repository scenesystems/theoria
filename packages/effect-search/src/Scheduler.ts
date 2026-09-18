/**
 * Multi-fidelity scheduling plans and execution summaries.
 *
 * @since 0.7.0
 * @module
 */
import { Chunk, Data, type Effect, Number as Num, Schema } from "effect"

import * as Constructors from "./internal/scheduler.js"
import type { Sampler, TpeOptions } from "./Sampler.js"
import type { InvalidOptimizationConfig } from "./SearchError.js"

/** Scheduler algorithm. @since 0.7.0 @category schemas */
export const Scheduler = Schema.Literal("hyperband", "bohb")
/** Scheduler algorithm. @since 0.7.0 @category models */
export type Scheduler = typeof Scheduler.Type

/** One successive-halving round. @since 0.7.0 @category models */
export class Round extends Data.Class<{
  readonly nConfigs: number
  readonly resource: number
}> {}

/** One successive-halving bracket. @since 0.7.0 @category models */
export class Bracket extends Data.Class<{
  readonly index: number
  readonly configs: number
  readonly minResource: number
  readonly rounds: Chunk.Chunk<Round>
}> {}

/** A complete scheduling plan. @since 0.7.0 @category models */
export class Plan extends Data.Class<{
  readonly mode: Scheduler
  readonly maxResource: number
  readonly reductionFactor: number
  readonly sampler: Sampler
  readonly brackets: Chunk.Chunk<Bracket>
  readonly randomFraction?: number
  readonly minObservations?: number
  readonly seed?: number
}> {}

/** One completed round. @since 0.7.0 @category models */
export class RoundSummary extends Data.Class<{
  readonly bracketIndex: number
  readonly roundIndex: number
  readonly nConfigs: number
  readonly resource: number
  readonly completed: number
  readonly bestValue?: number
}> {}

/** One completed bracket. @since 0.7.0 @category models */
export class BracketSummary extends Data.Class<{
  readonly bracketIndex: number
  readonly rounds: Chunk.Chunk<RoundSummary>
}> {}

/** Results for a completed scheduling plan. @since 0.7.0 @category models */
export class Summary extends Data.Class<{
  readonly mode: Scheduler
  readonly brackets: Chunk.Chunk<BracketSummary>
}> {}

/** Hyperband topology configuration. @since 0.7.0 @category models */
export class HyperbandOptions extends Data.Class<{
  readonly maxResource: number
  readonly reductionFactor: number
  readonly sampler: Sampler
}> {}

/** BOHB topology and model configuration. @since 0.7.0 @category models */
export class BohbOptions extends Data.Class<{
  readonly maxResource: number
  readonly reductionFactor: number
  readonly tpeOptions?: TpeOptions
  readonly explorationRatio?: number
  readonly seed?: number
}> {}

/** Counts planned evaluations. @since 0.7.0 @category combinators */
export const totalTrials = (plan: Plan): number =>
  Chunk.reduce(
    plan.brackets,
    0,
    (total, bracket) => Num.sum(total, Chunk.reduce(bracket.rounds, 0, (sum, round) => Num.sum(sum, round.nConfigs)))
  )

/** Builds a Hyperband plan. @since 0.7.0 @category constructors */
export const hyperband = (options: HyperbandOptions): Effect.Effect<Plan, InvalidOptimizationConfig> =>
  Constructors.hyperband(options)
/** Builds a BOHB plan. @since 0.7.0 @category constructors */
export const bohb = (options: BohbOptions): Effect.Effect<Plan, InvalidOptimizationConfig> => Constructors.bohb(options)
