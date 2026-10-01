/**
 * Shared math primitives for sampler implementations.
 *
 * @since 0.1.0
 */
import { squaredEuclideanDistance } from "@scenesystems/effect-math/Geometry"
import { dot, normL2 } from "@scenesystems/effect-math/LinearAlgebra"
import { minimum } from "@scenesystems/effect-math/Statistics"
import { Array as Arr, Chunk, Data, Number as Num, Option } from "effect"

const vectorValueAt = (
  vectorInput: Iterable<number>,
  index: number,
  fallback: number
): number => {
  const vector = Arr.fromIterable(vectorInput)
  return Arr.get(vector, index).pipe(Option.getOrElse(() => fallback))
}

const alignVectors = (
  leftInput: Iterable<number>,
  rightInput: Iterable<number>,
  fallback: number
) => {
  const left = Arr.fromIterable(leftInput)
  const right = Arr.fromIterable(rightInput)

  const dimension = Num.max(Arr.length(left), Arr.length(right))

  return Data.tuple(
    Arr.makeBy(dimension, (index) => vectorValueAt(left, index, fallback)),
    Arr.makeBy(dimension, (index) => vectorValueAt(right, index, fallback))
  )
}

/**
 * Squared Euclidean distance over vectors with sampler-safe fallback for
 * partial vectors (missing coordinates default to 0.5 in normalized space).
 *
 * @since 0.1.0
 * @category operations
 */
export const squaredDistance = (leftInput: Iterable<number>, rightInput: Iterable<number>): number => {
  const left = Arr.fromIterable(leftInput)
  const right = Arr.fromIterable(rightInput)

  const [alignedLeft, alignedRight] = alignVectors(left, right, 0.5)
  return squaredEuclideanDistance(Chunk.fromIterable(alignedLeft), Chunk.fromIterable(alignedRight))
}

/**
 * Dot product over sampler vectors. Missing coordinates are padded with zero
 * to preserve historical fallback semantics for uneven vectors.
 *
 * @since 0.1.0
 * @category operations
 */
export const dotProduct = (leftInput: Iterable<number>, rightInput: Iterable<number>): number => {
  const left = Arr.fromIterable(leftInput)
  const right = Arr.fromIterable(rightInput)

  const [alignedLeft, alignedRight] = alignVectors(left, right, 0)
  return dot(Chunk.fromIterable(alignedLeft), Chunk.fromIterable(alignedRight))
}

/**
 * Euclidean norm over sampler vectors.
 *
 * @since 0.1.0
 * @category operations
 */
export const l2Norm = (valuesInput: Iterable<number>): number => {
  const values = Arr.fromIterable(valuesInput)
  return normL2(Chunk.fromIterable(values))
}

/**
 * Minimum observed objective value from a scalar vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const minimumObserved = (
  valuesInput: Iterable<number>,
  fallback = 0
): number => {
  const values = Arr.fromIterable(valuesInput)
  return Option.getOrElse(minimum(Chunk.fromIterable(values)), () => fallback)
}
