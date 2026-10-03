/**
 * Hyperband and BOHB topology construction.
 *
 * @since 0.1.0
 */
import { ceil, floor, isFinite, log, pow } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Chunk, Effect, Match, Number as Num, Option } from "effect"

import * as Sampler from "../Sampler.js"
import { type BohbOptions, Bracket, type HyperbandOptions, Plan, Round } from "../Scheduler.js"
import { InvalidOptimizationConfig } from "../SearchError.js"

/**
 * Configures a Hyperband topology and its suggestion strategy.
 *
 * @since 0.1.0
 * @category type-level
 */
const invalidSchedulerConfig = (reason: string): InvalidOptimizationConfig =>
  new InvalidOptimizationConfig({
    reason: `Scheduler.${reason}`
  })

const countFromRound = (baseConfigs: number, reductionFactor: number, roundIndex: number): number =>
  Num.max(1, floor(Num.divideUnsafe(baseConfigs, pow(reductionFactor, roundIndex))))

const resourceFromRound = (baseResource: number, reductionFactor: number, roundIndex: number): number =>
  Num.max(1, floor(Num.multiply(baseResource, pow(reductionFactor, roundIndex))))

const sMaxFrom = (maxResource: number, reductionFactor: number): number =>
  floor(Num.divideUnsafe(log(maxResource), log(reductionFactor)))

const roundCountFromBracket = (bracketLevel: number): number => Num.increment(bracketLevel)

const roundsFromBracket = (
  baseConfigs: number,
  baseResource: number,
  reductionFactor: number,
  bracketLevel: number
) =>
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
  const numerator = Num.multiply(Num.increment(sMax), pow(reductionFactor, bracketLevel))
  const denominator = Num.increment(bracketLevel)
  const configs = Num.max(1, ceil(Num.divideUnsafe(numerator, denominator)))
  const minResource = Num.max(1, floor(Num.divideUnsafe(maxResource, pow(reductionFactor, bracketLevel))))

  return new Bracket({
    index: Num.subtract(sMax, bracketLevel),
    configs,
    minResource,
    rounds: Chunk.fromIterable(roundsFromBracket(configs, minResource, reductionFactor, bracketLevel))
  })
}

const validateSchedulerNumbers = (
  maxResource: number,
  reductionFactor: number
): Effect.Effect<void, InvalidOptimizationConfig> =>
  Effect.gen(function*() {
    yield* Effect.when(
      Effect.fail(invalidSchedulerConfig("hyperband requires maxResource >= 1")),
      Effect.sync(() => Bool.or(Bool.not(isFinite(maxResource)), Num.isLessThan(maxResource, 1)))
    )
    yield* Effect.when(
      Effect.fail(invalidSchedulerConfig("hyperband requires reductionFactor >= 2")),
      Effect.sync(() => Bool.or(Bool.not(isFinite(reductionFactor)), Num.isLessThan(reductionFactor, 2)))
    )
  })

const buildBrackets = (
  maxResource: number,
  reductionFactor: number
) =>
  validateSchedulerNumbers(maxResource, reductionFactor).pipe(
    Effect.map(() => {
      const sMax = sMaxFrom(maxResource, reductionFactor)

      return Arr.makeBy(
        Num.increment(sMax),
        (index) => bracketAtLevel(maxResource, reductionFactor, sMax, Num.subtract(sMax, index))
      )
    })
  )

const bohbExplorationRatio = (candidate: Option.Option<number>): Effect.Effect<number, InvalidOptimizationConfig> =>
  Option.match(candidate, {
    onNone: () => Effect.succeed(0.33),
    onSome: (ratio) =>
      Match.value(Bool.or(
        Bool.not(isFinite(ratio)),
        Bool.or(Num.isLessThan(ratio, 0), Num.isGreaterThan(ratio, 1))
      )).pipe(
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
 * `InvalidOptimizationConfig` before a scheduler is returned.
 *
 * @param options - Topology bounds and sampler used for new configurations.
 *
 * @since 0.1.0
 * @category constructors
 */
export const hyperband = (
  options: HyperbandOptions
): Effect.Effect<Plan, InvalidOptimizationConfig> =>
  buildBrackets(options.maxResource, options.reductionFactor).pipe(
    Effect.map(
      (brackets) =>
        new Plan({
          mode: "hyperband",
          maxResource: options.maxResource,
          reductionFactor: options.reductionFactor,
          sampler: options.sampler,
          brackets: Chunk.fromIterable(brackets)
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
 * Invalid topology values or exploration ratios fail with `InvalidOptimizationConfig`.
 * TPE option validation remains deferred until the sampler suggests a value.
 *
 * @param options - Topology bounds, TPE settings, exploration ratio, and seed.
 *
 * @since 0.1.0
 * @category constructors
 */
export const bohb = (
  options: BohbOptions
): Effect.Effect<Plan, InvalidOptimizationConfig> =>
  Effect.gen(function*() {
    const brackets = yield* buildBrackets(options.maxResource, options.reductionFactor)
    const explorationRatio = yield* bohbExplorationRatio(Option.fromNullishOr(options.explorationRatio))

    const tpeSampler = Sampler.tpe(
      Option.fromNullishOr(options.tpeOptions).pipe(
        Option.match({
          onNone: () =>
            new Sampler.TpeOptions({
              ...Option.match(Option.fromNullishOr(options.seed), {
                onNone: () => ({}),
                onSome: (seed) => ({ seed })
              })
            }),
          onSome: (tpeOptions) =>
            new Sampler.TpeOptions({
              ...Option.match(Option.fromNullishOr(tpeOptions.nStartupTrials), {
                onNone: () => ({}),
                onSome: (nStartupTrials) => ({ nStartupTrials })
              }),
              ...Option.match(Option.fromNullishOr(tpeOptions.nEiCandidates), {
                onNone: () => ({}),
                onSome: (nEiCandidates) => ({ nEiCandidates })
              }),
              ...Option.match(Option.fromNullishOr(tpeOptions.multivariate), {
                onNone: () => ({}),
                onSome: (multivariate) => ({ multivariate })
              }),
              ...Option.match(Option.fromNullishOr(tpeOptions.groupDimensions), {
                onNone: () => ({}),
                onSome: (groupDimensions) => ({ groupDimensions })
              }),
              ...Option.match(Option.fromNullishOr(tpeOptions.noiseAware), {
                onNone: () => ({}),
                onSome: (noiseAware) => ({ noiseAware })
              }),
              ...Option.match(Option.fromNullishOr(tpeOptions.noiseAlpha), {
                onNone: () => ({}),
                onSome: (noiseAlpha) => ({ noiseAlpha })
              }),
              ...Option.match(Option.fromNullishOr(tpeOptions.acquisition), {
                onNone: () => ({}),
                onSome: (acquisition) => ({ acquisition })
              }),
              ...Option.match(Option.fromNullishOr(tpeOptions.constraints), {
                onNone: () => ({}),
                onSome: (constraints) => ({ constraints })
              }),
              ...Option.match(
                Option.orElse(Option.fromNullishOr(tpeOptions.seed), () => Option.fromNullishOr(options.seed)),
                { onNone: () => ({}), onSome: (seed) => ({ seed }) }
              )
            })
        })
      )
    )

    return new Plan({
      mode: "bohb",
      maxResource: options.maxResource,
      reductionFactor: options.reductionFactor,
      sampler: tpeSampler,
      brackets: Chunk.fromIterable(brackets),
      randomFraction: explorationRatio,
      minObservations: 1,
      ...Option.fromNullishOr(options.seed).pipe(
        Option.match({
          onNone: () => ({}),
          onSome: (seed) => ({ seed })
        })
      )
    })
  })
