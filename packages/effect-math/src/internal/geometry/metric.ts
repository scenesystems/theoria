/**
 * Pure metric-space kernels over `Chunk` carriers using Effect primitives.
 * Arithmetic and square roots delegate to the public Numeric authority.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Iterable, Number, Option, pipe, Tuple } from "effect"

import { abs, hypot } from "../../Numeric.js"

const indices = (size: number): Chunk.Chunk<number> =>
  Chunk.fromIterable(
    Iterable.unfold(0, (index) =>
      Boolean.match(Number.lessThan(index, size), {
        onFalse: Option.none,
        onTrue: () => Option.some(Tuple.make(index, Number.increment(index)))
      }))
  )

/**
 * Squared Euclidean distance: `Σ (aᵢ − bᵢ)²`. Both chunks must have equal
 * length — no runtime guard is applied (use `distanceValidated` for validated
 * input).
 *
 * @since 0.1.0
 * @category internal
 */
export const squaredEuclideanDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number =>
  pipe(
    Chunk.zipWith(a, b, (ai, bi) => {
      const diff = Number.subtract(ai, bi)
      return Number.multiply(diff, diff)
    }),
    Chunk.reduce(0, Number.sum)
  )

/**
 * Euclidean distance: `√(Σ (aᵢ − bᵢ)²)`. Both chunks must have equal
 * length — no runtime guard is applied (use `distanceValidated` for validated
 * input).
 *
 * @since 0.1.0
 * @category internal
 */
export const euclideanDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number =>
  hypot(Chunk.zipWith(a, b, Number.subtract))

/**
 * Manhattan distance: `Σ |aᵢ − bᵢ|`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const manhattanDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number =>
  pipe(
    Chunk.zipWith(a, b, (ai, bi) => abs(Number.subtract(ai, bi))),
    Chunk.reduce(0, Number.sum)
  )

/**
 * Chebyshev distance: `max |aᵢ − bᵢ|`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const chebyshevDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number =>
  pipe(
    Chunk.zipWith(a, b, (ai, bi) => abs(Number.subtract(ai, bi))),
    Chunk.reduce(0, Number.max)
  )

/**
 * Elementwise midpoint: `(aᵢ + bᵢ) / 2`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const midpoint = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): Chunk.Chunk<number> =>
  Chunk.zipWith(a, b, (ai, bi) => Number.multiply(Number.sum(ai, bi), 0.5))

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
        (acc, pt) => Number.sum(acc, Option.getOrElse(Chunk.get(pt, j), () => 0))
      ),
      Number.unsafeDivide(1, n)
    ))
}
