/**
 * Scheduler constructors: HyperBand and BOHB.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option } from "effect"

import { InvalidStudyConfig } from "../Errors/index.js"
import * as Sampler from "../Sampler/index.js"
import { type TpeOptions } from "../Sampler/index.js"
import { Bracket, Round, Scheduler } from "./model.js"

/**
 * @since 0.1.0
 * @category type-level
 */
export class HyperbandOptions extends Data.Class<{
  readonly maxResource: number
  readonly reductionFactor: number
  readonly sampler: Sampler.Sampler
}> {}

/**
 * @since 0.1.0
 * @category type-level
 */
export class BohbOptions extends Data.Class<{
  readonly maxResource: number
  readonly reductionFactor: number
  readonly tpeOptions?: TpeOptions
  readonly explorationRatio?: number
  readonly seed?: number
}> {}

const invalidSchedulerConfig = (reason: string): InvalidStudyConfig =>
  new InvalidStudyConfig({
    reason: `Scheduler.${reason}`
  })

const countFromRound = (baseConfigs: number, reductionFactor: number, roundIndex: number): number =>
  Num.max(1, Math.floor(baseConfigs / Math.pow(reductionFactor, roundIndex)))

const resourceFromRound = (baseResource: number, reductionFactor: number, roundIndex: number): number =>
  Num.max(1, Math.floor(baseResource * Math.pow(reductionFactor, roundIndex)))

const sMaxFrom = (maxResource: number, reductionFactor: number): number =>
  Math.floor(Math.log(maxResource) / Math.log(reductionFactor))

const roundCountFromBracket = (bracketLevel: number): number => Num.increment(bracketLevel)

const roundsFromBracket = (
  baseConfigs: number,
  baseResource: number,
  reductionFactor: number,
  bracketLevel: number
): ReadonlyArray<Round> =>
  Arr.makeBy(roundCountFromBracket(bracketLevel), (roundIndex) =>
    new Round({
      nConfigs: countFromRound(baseConfigs, reductionFactor, roundIndex),
      resource: resourceFromRound(baseResource, reductionFactor, roundIndex)
    }))

const bracketAtLevel = (
  maxResource: number,
  reductionFactor: number,
  sMax: number,
  bracketLevel: number
): Bracket => {
  const numerator = Num.increment(sMax) * Math.pow(reductionFactor, bracketLevel)
  const denominator = Num.increment(bracketLevel)
  const configs = Num.max(1, Math.ceil(numerator / denominator))
  const minResource = Num.max(1, Math.floor(maxResource / Math.pow(reductionFactor, bracketLevel)))

  return new Bracket({
    index: sMax - bracketLevel,
    configs,
    minResource,
    rounds: roundsFromBracket(configs, minResource, reductionFactor, bracketLevel)
  })
}

const validateSchedulerNumbers = (
  maxResource: number,
  reductionFactor: number
): Effect.Effect<void, InvalidStudyConfig> =>
  Effect.gen(function*() {
    yield* Effect.when(
      Effect.fail(invalidSchedulerConfig("hyperband requires maxResource >= 1")),
      () => Num.lessThan(maxResource, 1)
    )
    yield* Effect.when(
      Effect.fail(invalidSchedulerConfig("hyperband requires reductionFactor >= 2")),
      () => Num.lessThan(reductionFactor, 2)
    )
  })

const buildBrackets = (
  maxResource: number,
  reductionFactor: number
): Effect.Effect<ReadonlyArray<Bracket>, InvalidStudyConfig> =>
  validateSchedulerNumbers(maxResource, reductionFactor).pipe(
    Effect.map(() => {
      const sMax = sMaxFrom(maxResource, reductionFactor)

      return Arr.makeBy(
        Num.increment(sMax),
        (index) => bracketAtLevel(maxResource, reductionFactor, sMax, sMax - index)
      )
    })
  )

const bohbExplorationRatio = (candidate: Option.Option<number>): Effect.Effect<number, InvalidStudyConfig> =>
  Option.match(candidate, {
    onNone: () => Effect.succeed(0.33),
    onSome: (ratio) =>
      Match.value(Num.lessThan(ratio, 0) || Num.greaterThan(ratio, 1)).pipe(
        Match.when(true, () => Effect.fail(invalidSchedulerConfig("bohb explorationRatio must be between 0 and 1"))),
        Match.orElse(() => Effect.succeed(ratio))
      )
  })

/**
 * Construct a HyperBand scheduler with precomputed bracket/round topology.
 *
 * @since 0.1.0
 * @category constructors
 */
export const hyperband = (
  options: HyperbandOptions
): Effect.Effect<Scheduler, InvalidStudyConfig> =>
  buildBrackets(options.maxResource, options.reductionFactor).pipe(
    Effect.map(
      (brackets) =>
        new Scheduler({
          mode: "hyperband",
          maxResource: options.maxResource,
          reductionFactor: options.reductionFactor,
          sampler: options.sampler,
          brackets
        })
    )
  )

/**
 * Bayesian Optimization HyperBand scheduler — combines Successive Halving
 * brackets with TPE-guided sampling for resource-efficient hyperparameter
 * search.
 *
 * @since 0.1.0
 * @category constructors
 */
export const bohb = (
  options: BohbOptions
): Effect.Effect<Scheduler, InvalidStudyConfig> =>
  Effect.gen(function*() {
    const brackets = yield* buildBrackets(options.maxResource, options.reductionFactor)
    const explorationRatio = yield* bohbExplorationRatio(Option.fromNullable(options.explorationRatio))

    const tpeSampler = Sampler.tpe(
      Option.fromNullable(options.tpeOptions).pipe(
        Option.match({
          onNone: () => ({ seed: options.seed }),
          onSome: (tpeOptions) => ({ ...tpeOptions, seed: tpeOptions.seed ?? options.seed })
        })
      )
    )

    return new Scheduler({
      mode: "bohb",
      maxResource: options.maxResource,
      reductionFactor: options.reductionFactor,
      sampler: tpeSampler,
      brackets,
      randomFraction: explorationRatio,
      minObservations: 1,
      ...Option.fromNullable(options.seed).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (seed) => ({ seed })
        })
      )
    })
  })
