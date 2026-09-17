/**
 * Pure metric-space kernels over `Chunk` carriers using Effect primitives.
 * Arithmetic and square roots delegate to the public Numeric authority.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, Number, Option } from "effect"

import { abs, hypot } from "../../Numeric.js"

const indices = (size: number): Chunk.Chunk<number> =>
  Boolean.match(Number.greaterThan(size, 0), {
    onFalse: Chunk.empty,
    onTrue: () => Chunk.makeBy(size, (index) => index)
  })

/**
 * Squared Euclidean distance: `Σ (aᵢ − bᵢ)²`. Both chunks must have equal
 * length — no runtime guard is applied (use `distanceValidated` for validated
 * input).
 *
 * @since 0.1.0
 * @category internal
 */
export const squaredEuclideanDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number => {
  const transientB = Chunk.toReadonlyArray(b)
  return Chunk.reduce(
    Chunk.take(a, Number.min(Chunk.size(a), Chunk.size(b))),
    0,
    (sum, ai, index) => {
      const diff = Number.subtract(ai, Array.unsafeGet(transientB, index))
      return Number.sum(sum, Number.multiply(diff, diff))
    }
  )
}

/**
 * Euclidean distance: `√(Σ (aᵢ − bᵢ)²)`. Both chunks must have equal
 * length — no runtime guard is applied (use `distanceValidated` for validated
 * input).
 *
 * @since 0.1.0
 * @category internal
 */
export const euclideanDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number => {
  const transientB = Chunk.toReadonlyArray(b)
  return hypot(
    Chunk.map(
      Chunk.take(a, Number.min(Chunk.size(a), Chunk.size(b))),
      (ai, index) => Number.subtract(ai, Array.unsafeGet(transientB, index))
    )
  )
}

/**
 * Manhattan distance: `Σ |aᵢ − bᵢ|`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const manhattanDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number => {
  const transientB = Chunk.toReadonlyArray(b)
  return Chunk.reduce(
    Chunk.take(a, Number.min(Chunk.size(a), Chunk.size(b))),
    0,
    (sum, ai, index) => Number.sum(sum, abs(Number.subtract(ai, Array.unsafeGet(transientB, index))))
  )
}

/**
 * Chebyshev distance: `max |aᵢ − bᵢ|`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const chebyshevDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number => {
  const transientB = Chunk.toReadonlyArray(b)
  return Chunk.reduce(
    Chunk.take(a, Number.min(Chunk.size(a), Chunk.size(b))),
    0,
    (maximum, ai, index) => Number.max(maximum, abs(Number.subtract(ai, Array.unsafeGet(transientB, index))))
  )
}

/**
 * Elementwise midpoint: `(aᵢ + bᵢ) / 2`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const midpoint = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): Chunk.Chunk<number> => {
  const transientB = Chunk.toReadonlyArray(b)
  return Chunk.map(
    Chunk.take(a, Number.min(Chunk.size(a), Chunk.size(b))),
    (ai, index) => Number.multiply(Number.sum(ai, Array.unsafeGet(transientB, index)), 0.5)
  )
}

/**
 * Centroid (arithmetic mean) of a non-empty collection of points. Each point
 * is a `Chunk<number>`. All points must have equal dimensionality — no
 * runtime guard is applied (use `centroidValidated` for validated input).
 *
 * @since 0.1.0
 * @category internal
 */
export const centroid = (
  points: Chunk.Chunk<Chunk.Chunk<number>>
): Chunk.Chunk<number> => {
  const n = Chunk.size(points)
  const firstPoint = Option.getOrElse(Chunk.get(points, 0), () => Chunk.empty<number>())
  const dim = Chunk.size(firstPoint)
  return Chunk.map(indices(dim), (j) =>
    Number.multiply(
      Chunk.reduce(
        points,
        0,
        (acc, point) => Number.sum(acc, Option.getOrElse(Chunk.get(point, j), () => 0))
      ),
      Number.unsafeDivide(1, n)
    ))
}
