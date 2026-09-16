/**
 * Gaussian-process posterior utilities for GP-BO.
 *
 * @since 0.1.0
 */
import {
  backwardSubstitutionUpper,
  cholesky,
  forwardSubstitutionLower,
  transpose
} from "@scenesystems/effect-math/LinearAlgebra"
import { floor } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Chunk, Data, Match, Number as Num, Option } from "effect"

import type { Vector } from "../../../Objective.js"

import { exp } from "../../exponential.js"
import { dotProduct, squaredDistance } from "../math.js"

/**
 * Minimal GP observation shape consumed by posterior routines.
 *
 * @since 0.1.0
 * @category models
 */
export class GpObservationLike extends Data.Class<{
  readonly vector: Vector
  readonly value: number
}> {}

class PosteriorModel extends Data.Class<{
  readonly observations: Chunk.Chunk<GpObservationLike>
  readonly lower: Chunk.Chunk<number>
  readonly alpha: Vector
  readonly lengthScale: number
  readonly noise: number
}> {}

const varianceFloor = 1e-12

const rbfKernel = (leftInput: Iterable<number>, rightInput: Iterable<number>, lengthScale: number): number => {
  const left = Arr.fromIterable(leftInput)
  const right = Arr.fromIterable(rightInput)
  return exp(
    Num.negate(
      Num.unsafeDivide(
        squaredDistance(left, right),
        Num.multiply(2, Num.multiply(lengthScale, lengthScale))
      )
    )
  )
}

const buildKernelMatrix = (
  observationsInput: Iterable<GpObservationLike>,
  lengthScale: number,
  noise: number
): Chunk.Chunk<number> => {
  const observations = Arr.fromIterable(observationsInput)
  return Chunk.makeBy(Num.multiply(Arr.length(observations), Arr.length(observations)), (flatIndex) => {
    const row = floor(Num.unsafeDivide(flatIndex, Arr.length(observations)))
    const column = Num.remainder(flatIndex, Arr.length(observations))
    const rowVector = Arr.get(observations, row).pipe(
      Option.map((observation) => observation.vector),
      Option.getOrElse(() => Arr.empty<number>())
    )
    const columnVector = Arr.get(observations, column).pipe(
      Option.map((observation) => observation.vector),
      Option.getOrElse(() => Arr.empty<number>())
    )
    const base = rbfKernel(rowVector, columnVector, lengthScale)
    return Match.value(Num.Equivalence(row, column)).pipe(
      Match.when(true, () => Num.sum(base, Num.sum(noise, varianceFloor))),
      Match.orElse(() => base)
    )
  })
}

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
  observationsInput: Iterable<GpObservationLike>,
  lengthScale: number,
  noise: number
): Option.Option<PosteriorModel> => {
  const observations = Arr.fromIterable(observationsInput)
  return Match.value(Num.lessThanOrEqualTo(Arr.length(observations), 0)).pipe(
    Match.when(true, () => Option.none()),
    Match.orElse(() => {
      const size = Arr.length(observations)
      const kernel = buildKernelMatrix(observations, lengthScale, noise)
      const rhs = Chunk.fromIterable(Arr.map(observations, (observation) => observation.value))

      return cholesky(kernel, size).pipe(
        Option.flatMap((lower) =>
          solvePosteriorWeights(lower, size, rhs).pipe(
            Option.map(
              (alpha) =>
                new PosteriorModel({
                  observations: Chunk.fromIterable(observations),
                  lower,
                  alpha: Chunk.toReadonlyArray(alpha),
                  lengthScale,
                  noise
                })
            )
          )
        )
      )
    })
  )
}

class PosteriorPrediction extends Data.Class<{
  readonly mean: number
  readonly variance: number
}> {}

/**
 * Predicts posterior mean and variance for a candidate vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const predictPosterior = (
  model: PosteriorModel,
  candidateInput: Iterable<number>
): PosteriorPrediction => {
  const candidate = Arr.fromIterable(candidateInput)
  const observations = Arr.fromIterable(model.observations)

  const crossCovariance = Arr.map(
    observations,
    (observation) => rbfKernel(candidate, observation.vector, model.lengthScale)
  )
  const mean = dotProduct(crossCovariance, model.alpha)
  const variance = forwardSubstitutionLower(
    model.lower,
    Chunk.size(model.observations),
    Chunk.fromIterable(crossCovariance)
  ).pipe(
    Option.match({
      onNone: () => 1,
      onSome: (projectionChunk) => {
        const projection = Chunk.toReadonlyArray(projectionChunk)
        const predictive = Num.subtract(
          Num.sum(rbfKernel(candidate, candidate, model.lengthScale), model.noise),
          dotProduct(projection, projection)
        )
        return Match.value(Num.greaterThan(predictive, varianceFloor)).pipe(
          Match.when(true, () => predictive),
          Match.orElse(() => varianceFloor)
        )
      }
    })
  )

  return new PosteriorPrediction({ mean, variance })
}
