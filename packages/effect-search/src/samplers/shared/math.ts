/**
 * Shared math primitives for sampler implementations.
 *
 * @since 0.1.0
 */
import { Array as Arr, Chunk, Option } from "effect"
import { squaredEuclideanDistance } from "effect-math/Geometry"
import { dot, normL2 } from "effect-math/LinearAlgebra"
import { minimum } from "effect-math/Statistics"

const vectorValueAt = (
  vector: ReadonlyArray<number>,
  index: number,
  fallback: number
): number => Arr.get(vector, index).pipe(Option.getOrElse(() => fallback))

const alignVectors = (
  left: ReadonlyArray<number>,
  right: ReadonlyArray<number>,
  fallback: number
): readonly [ReadonlyArray<number>, ReadonlyArray<number>] => {
  const dimension = Math.max(left.length, right.length)

  return [
    Arr.makeBy(dimension, (index) => vectorValueAt(left, index, fallback)),
    Arr.makeBy(dimension, (index) => vectorValueAt(right, index, fallback))
  ]
}

/**
 * Squared Euclidean distance over vectors with sampler-safe fallback for
 * partial vectors (missing coordinates default to 0.5 in normalized space).
 *
 * @since 0.1.0
 * @category operations
 */
export const squaredDistance = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): number => {
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
export const dotProduct = (left: ReadonlyArray<number>, right: ReadonlyArray<number>): number => {
  const [alignedLeft, alignedRight] = alignVectors(left, right, 0)
  return dot(Chunk.fromIterable(alignedLeft), Chunk.fromIterable(alignedRight))
}

/**
 * Euclidean norm over sampler vectors.
 *
 * @since 0.1.0
 * @category operations
 */
export const l2Norm = (values: ReadonlyArray<number>): number => normL2(Chunk.fromIterable(values))

/**
 * Minimum observed objective value from a scalar vector.
 *
 * @since 0.1.0
 * @category operations
 */
export const minimumObserved = (
  values: ReadonlyArray<number>,
  fallback = 0
): number => Option.getOrElse(minimum(Chunk.fromIterable(values)), () => fallback)
