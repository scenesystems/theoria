/**
 * TPE candidate selection — argmax-based best-candidate extraction and random roll generation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Match, Number as Num, Option } from "effect"

import type { InvalidSamplerConfig } from "../../Errors/index.js"
import * as Rng from "../../internal/rng.js"
import { argmax } from "../../internal/tpe/expectedImprovement.js"
import { type CandidateRollPair, makeCandidateRollPair } from "./dimensions/trace.js"
import { invalidConfig } from "./options.js"

const indices = (count: number): Array<number> =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => []),
    Match.orElse(() => Arr.makeBy(count, (index) => index))
  )

/**
 * Selects the candidate with the highest acquisition score via argmax,
 * failing with {@link InvalidSamplerConfig} if the candidate array is
 * empty. This is the final selection step in the TPE suggest pipeline
 * after all candidates have been scored.
 *
 * @see {@link drawRolls} for generating candidate sampling rolls
 * @see {@link drawRollPairs} for multivariate candidate generation
 * @since 0.1.0
 * @category sampling
 */
export const chooseBestCandidate = <A>(
  candidates: ReadonlyArray<A>,
  scores: ReadonlyArray<number>,
  reason: string
): Effect.Effect<A, InvalidSamplerConfig> => {
  const bestIndex = argmax([...scores])

  return Arr.get(candidates, bestIndex).pipe(
    Option.match({
      onNone: () => Effect.fail(invalidConfig(reason)),
      onSome: Effect.succeed
    })
  )
}

/**
 * Draws `count` uniform random floats from the RNG for use as
 * candidate sampling rolls in univariate TPE dimension scoring.
 * Each roll seeds one candidate sample from the Parzen estimator.
 *
 * @see {@link chooseBestCandidate} for selecting among scored candidates
 * @see {@link drawRollPairs} for the multivariate variant
 * @since 0.1.0
 * @category sampling
 */
export const drawRolls = (
  rng: Rng.Rng,
  count: number
): Effect.Effect<Array<number>> => Effect.forEach(indices(count), () => Rng.nextFloat(rng))

/**
 * Draws `count` pairs of random floats (kernel roll + value roll) for
 * multivariate candidate generation. The kernel roll selects which
 * mixture component to sample from, while the value roll determines
 * the sample position within that component.
 *
 * @see {@link CandidateRollPair} for the pair structure
 * @see {@link drawRolls} for the univariate variant
 * @since 0.1.0
 * @category sampling
 */
export const drawRollPairs = (
  rng: Rng.Rng,
  count: number
): Effect.Effect<Array<CandidateRollPair>> =>
  Effect.forEach(indices(count), () =>
    Effect.all([Rng.nextFloat(rng), Rng.nextFloat(rng)]).pipe(
      Effect.map(([kernelRoll, valueRoll]) => makeCandidateRollPair(kernelRoll, valueRoll))
    ))
