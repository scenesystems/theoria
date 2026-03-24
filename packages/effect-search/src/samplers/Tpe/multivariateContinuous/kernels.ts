/**
 * Multivariate kernel utilities — per-dimension statistics, uniform weights, and roll generation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option } from "effect"

import * as Rng from "../../../internal/rng.js"

/** @since 0.1.0 */
export class MultivariateCandidateRoll extends Data.Class<{
  readonly componentRoll: number
  readonly valueRolls: ReadonlyArray<number>
}> {}

const indices = (count: number): ReadonlyArray<number> =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, (index) => index))
  )

/** @since 0.1.0 */
export const valueAt = (values: ReadonlyArray<number>, index: number, fallback: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => fallback))

const average = (values: ReadonlyArray<number>): number =>
  Match.value(Num.lessThanOrEqualTo(values.length, 0)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() => Num.unsafeDivide(Arr.reduce(values, 0, (sum, value) => Num.sum(sum, value)), values.length))
  )

const stddev = (values: ReadonlyArray<number>, mean: number): number =>
  Match.value(Num.lessThanOrEqualTo(values.length, 0)).pipe(
    Match.when(true, () => 1),
    Match.orElse(() => {
      const variance = Num.unsafeDivide(
        Arr.reduce(values, 0, (sum, value) => {
          const centered = value - mean
          return Num.sum(sum, centered * centered)
        }),
        values.length
      )

      return Math.sqrt(variance)
    })
  )

/** @since 0.1.0 */
export const statsByDimension = (
  vectors: ReadonlyArray<ReadonlyArray<number>>,
  dimensionCount: number
): ReadonlyArray<{ readonly mean: number; readonly stddev: number }> =>
  Arr.makeBy(dimensionCount, (dimensionIndex) => {
    const values = Arr.map(vectors, (vector) => valueAt(vector, dimensionIndex, 0))
    const mean = average(values)
    return {
      mean,
      stddev: stddev(values, mean)
    }
  })

/** @since 0.1.0 */
export const uniformWeights = (componentCount: number): ReadonlyArray<number> =>
  Match.value(Num.lessThanOrEqualTo(componentCount, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(componentCount, () => Num.unsafeDivide(1, componentCount)))
  )

/** @since 0.1.0 */
export const drawMultivariateRolls = (
  rng: Rng.Rng,
  nCandidates: number,
  dimensionCount: number
): Effect.Effect<ReadonlyArray<MultivariateCandidateRoll>> =>
  Effect.forEach(indices(nCandidates), () =>
    Effect.all([
      Rng.nextFloat(rng),
      Effect.forEach(indices(dimensionCount), () => Rng.nextFloat(rng))
    ]).pipe(
      Effect.map(([componentRoll, valueRolls]) =>
        new MultivariateCandidateRoll({
          componentRoll,
          valueRolls
        })
      )
    ))
