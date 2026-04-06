/**
 * Multivariate kernel utilities — per-dimension statistics, uniform weights, and roll generation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Match, Number as Num, Option } from "effect"
import { sqrt } from "effect-math/Numeric"

import * as Rng from "../../../internal/rng.js"

/**
 * Random draws used to sample a single candidate from a diagonal Gaussian
 * mixture — a component selection roll plus one value roll per dimension.
 *
 * Pre-drawing rolls decouples randomness from density estimation, enabling
 * deterministic replay from a checkpoint.
 *
 * @see {@link drawMultivariateRolls} for batch generation of roll sets
 * @since 0.1.0
 * @category models
 */
export class MultivariateCandidateRoll extends Data.Class<{
  readonly componentRoll: number
  readonly valueRolls: ReadonlyArray<number>
}> {}

const indices = (count: number): ReadonlyArray<number> =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, (index) => index))
  )

/**
 * Safely retrieves a numeric value at `index`, returning `fallback` when the
 * index is out of bounds.
 *
 * Used throughout kernel density estimation where missing dimensions should
 * degrade gracefully rather than throw.
 *
 * @see {@link statsByDimension} for a consumer that indexes across dimension vectors
 * @since 0.1.0
 * @category constructors
 */
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

      return sqrt(variance)
    })
  )

/**
 * Computes per-dimension mean and standard deviation across a set of
 * observation vectors, used to derive Scott's bandwidth for the diagonal
 * Gaussian kernel.
 *
 * The resulting statistics determine how wide each kernel component spreads
 * in each dimension of the multivariate Parzen estimator.
 *
 * @see {@link uniformWeights} for the companion equal-weight initialization
 * @since 0.1.0
 * @category scoring
 */
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

/**
 * Generates equal mixture weights (1/n each) for a Gaussian mixture with
 * `componentCount` components.
 *
 * Uniform weights are the default initialization — each observed data point
 * contributes equally to the mixture density before any pruning or
 * re-weighting.
 *
 * @see {@link statsByDimension} for per-dimension kernel statistics
 * @since 0.1.0
 * @category constructors
 */
export const uniformWeights = (componentCount: number): ReadonlyArray<number> =>
  Match.value(Num.lessThanOrEqualTo(componentCount, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(componentCount, () => Num.unsafeDivide(1, componentCount)))
  )

/**
 * Draws `nCandidates` sets of random rolls from the RNG — one
 * component-selection roll and `dimensionCount` value rolls per candidate —
 * for use in diagonal Gaussian mixture sampling.
 *
 * All randomness is consumed up front so the density estimation and scoring
 * phases remain deterministic given the same roll sequence.
 *
 * @see {@link MultivariateCandidateRoll} for the per-candidate roll structure
 * @since 0.1.0
 * @category sampling
 */
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
