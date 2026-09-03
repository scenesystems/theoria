/**
 * Hyperband and BOHB topology construction.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option } from "effect"

import { InvalidStudyConfig } from "../Errors/index.js"
import * as Sampler from "../Sampler/index.js"
import { type TpeOptions } from "../Sampler/index.js"
import { Bracket, Round, Scheduler } from "./model.js"

/**
 * Configures a Hyperband topology and its suggestion strategy.
 *
 * @since 0.1.0
 * @category type-level
 */
export class HyperbandOptions extends Data.Class<{
  /** Finite upper resource budget; must be at least `1`. */
  readonly maxResource: number
  /** Finite ratio between successive rounds; must be at least `2`. */
  readonly reductionFactor: number
  /** Proposes initial configurations and replacements for failed evaluations. */
  readonly sampler: Sampler.Sampler
}> {}

/**
 * Configures a BOHB topology, TPE strategy, and random exploration rate.
 *
 * @since 0.1.0
 * @category type-level
 */
export class BohbOptions extends Data.Class<{
  /** Finite upper resource budget; must be at least `1`. */
  readonly maxResource: number
  /** Finite ratio between successive rounds; must be at least `2`. */
  readonly reductionFactor: number
  /** Serializable TPE options; its seed takes precedence over the top-level seed. */
  readonly tpeOptions?: TpeOptions
  /** Probability of a random suggestion after initial observations; defaults to `0.33`. */
  readonly explorationRatio?: number
  /** Seeds BOHB's exploration decision and random suggestions. */
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
      () => !Number.isFinite(maxResource) || Num.lessThan(maxResource, 1)
    )
    yield* Effect.when(
      Effect.fail(invalidSchedulerConfig("hyperband requires reductionFactor >= 2")),
      () => !Number.isFinite(reductionFactor) || Num.lessThan(reductionFactor, 2)
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
      Match.value(!Number.isFinite(ratio) || Num.lessThan(ratio, 0) || Num.greaterThan(ratio, 1)).pipe(
        Match.when(true, () => Effect.fail(invalidSchedulerConfig("bohb explorationRatio must be between 0 and 1"))),
        Match.orElse(() => Effect.succeed(ratio))
      )
  })

/**
 * Builds successive-halving brackets up to the requested resource budget.
 *
 * @remarks
 * Round resources and configuration counts use integer floors with a minimum of
 * `1`. Brackets run sequentially; evaluations within each round use the Study
 * concurrency setting. Non-finite or out-of-range topology values fail with
 * `InvalidStudyConfig` before a scheduler is returned.
 *
 * @param options - Topology bounds and sampler used for new configurations.
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
 * Builds Hyperband brackets with BOHB random exploration and TPE suggestions.
 *
 * @remarks
 * BOHB uses random suggestions until the study has more completed observations
 * than search-space dimensions. Later suggestions choose random sampling with
 * `explorationRatio`; all other suggestions use the configured TPE sampler,
 * which retains its own startup threshold. The top-level seed is copied into
 * TPE options only when `tpeOptions.seed` is absent.
 *
 * Invalid topology values or exploration ratios fail with `InvalidStudyConfig`.
 * TPE option validation remains deferred until the sampler suggests a value.
 *
 * @param options - Topology bounds, TPE settings, exploration ratio, and seed.
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
