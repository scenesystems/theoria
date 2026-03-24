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

/** @since 0.1.0 */
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

/** @since 0.1.0 */
export const drawRolls = (
  rng: Rng.Rng,
  count: number
): Effect.Effect<Array<number>> => Effect.forEach(indices(count), () => Rng.nextFloat(rng))

/** @since 0.1.0 */
export const drawRollPairs = (
  rng: Rng.Rng,
  count: number
): Effect.Effect<Array<CandidateRollPair>> =>
  Effect.forEach(indices(count), () =>
    Effect.all([Rng.nextFloat(rng), Rng.nextFloat(rng)]).pipe(
      Effect.map(([kernelRoll, valueRoll]) => makeCandidateRollPair(kernelRoll, valueRoll))
    ))
