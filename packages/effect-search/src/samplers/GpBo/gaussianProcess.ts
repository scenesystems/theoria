/**
 * Gaussian-process posterior utilities for GP-BO.
 *
 * @since 0.1.0
 */
import { Array as Arr, Chunk, Data, Option } from "effect"
import { backwardSubstitutionUpper, cholesky, forwardSubstitutionLower, transpose } from "effect-math/LinearAlgebra"
import { exp } from "effect-math/Numeric"

import { dotProduct, squaredDistance } from "../shared/math.js"

/**
 * Minimal GP observation shape consumed by posterior routines.
 *
 * @since 0.1.0
 * @category models
 */
export class GpObservationLike extends Data.Class<{
  readonly vector: ReadonlyArray<number>
  readonly value: number
}> {}

class PosteriorModel extends Data.Class<{
  readonly observations: ReadonlyArray<GpObservationLike>
  readonly lower: Chunk.Chunk<number>
  readonly alpha: ReadonlyArray<number>
  readonly lengthScale: number
  readonly noise: number
}> {}

const EPSILON = 1e-12

const rbfKernel = (left: ReadonlyArray<number>, right: ReadonlyArray<number>, lengthScale: number): number =>
  exp(-(squaredDistance(left, right) / (2 * lengthScale * lengthScale)))

const buildKernelMatrix = (
  observations: ReadonlyArray<GpObservationLike>,
  lengthScale: number,
  noise: number
): Chunk.Chunk<number> =>
  Chunk.makeBy(observations.length * observations.length, (flatIndex) => {
    const row = Math.floor(flatIndex / observations.length)
    const column = flatIndex % observations.length
    const rowVector = observations[row]?.vector ?? Arr.empty<number>()
    const columnVector = observations[column]?.vector ?? Arr.empty<number>()
    const base = rbfKernel(rowVector, columnVector, lengthScale)
    return row === column ? base + noise + EPSILON : base
  })

const solvePosteriorWeights = (
  lower: Chunk.Chunk<number>,
  size: number,
  rhs: Chunk.Chunk<number>
): Option.Option<Chunk.Chunk<number>> =>
  forwardSubstitutionLower(lower, size, rhs).pipe(
    Option.flatMap((forward) =>
      backwardSubstitutionUpper(
        transpose(lower, size, size),
        size,
        forward
      )
    )
  )

/**
 * Builds GP posterior state from observed vectors and scalar outcomes.
 * Returns `Option.none()` when the kernel system cannot be solved.
 *
 * @since 0.1.0
 * @category operations
 */
export const buildPosterior = (
  observations: ReadonlyArray<GpObservationLike>,
  lengthScale: number,
  noise: number
): Option.Option<PosteriorModel> =>
  observations.length <= 0
    ? Option.none()
    : (() => {
      const size = observations.length
      const kernel = buildKernelMatrix(observations, lengthScale, noise)
      const rhs = Chunk.fromIterable(Arr.map(observations, (observation) => observation.value))

      return cholesky(kernel, size).pipe(
        Option.flatMap((lower) =>
          solvePosteriorWeights(lower, size, rhs).pipe(
            Option.map(
              (alpha) =>
                new PosteriorModel({
                  observations,
                  lower,
                  alpha: Chunk.toReadonlyArray(alpha),
                  lengthScale,
                  noise
                })
            )
          )
        )
      )
    })()

/**
 * Predicts posterior mean and variance for a candidate vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const predictPosterior = (
  model: PosteriorModel,
  candidate: ReadonlyArray<number>
): { readonly mean: number; readonly variance: number } => {
  const crossCovariance = Arr.map(
    model.observations,
    (observation) => rbfKernel(candidate, observation.vector, model.lengthScale)
  )
  const mean = dotProduct(crossCovariance, model.alpha)
  const variance = forwardSubstitutionLower(
    model.lower,
    model.observations.length,
    Chunk.fromIterable(crossCovariance)
  ).pipe(
    Option.match({
      onNone: () => 1,
      onSome: (projectionChunk) => {
        const projection = Chunk.toReadonlyArray(projectionChunk)
        const predictive = (rbfKernel(candidate, candidate, model.lengthScale) + model.noise) -
          dotProduct(projection, projection)
        return predictive > EPSILON ? predictive : EPSILON
      }
    })
  )

  return { mean, variance }
}
