/**
 * Pure metric-space kernels over `Chunk` carriers using Effect primitives.
 * All arithmetic uses `Number.sum`, `Number.multiply`, `Number.subtract`,
 * `Number.negate`, `Number.max`. `Math.sqrt` is the only plain JS function
 * used (deterministic IEEE 754 leaf).
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N, Option, pipe } from "effect"

/**
 * Absolute value via `Number.negate` and `Number.max` — avoids `Math.abs`.
 *
 * @since 0.1.0
 * @category internal
 */
const abs = (x: number): number => N.max(x, N.negate(x))

/**
 * Euclidean distance: `√(Σ (aᵢ − bᵢ)²)`. Both chunks must have equal
 * length — no runtime guard is applied (use `distanceValidated` for validated
 * input).
 *
 * @since 0.1.0
 * @category internal
 */
export const euclideanDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number =>
  Math.sqrt(
    pipe(
      Chunk.zipWith(a, b, (ai, bi) => {
        const diff = N.subtract(ai, bi)
        return N.multiply(diff, diff)
      }),
      Chunk.reduce(0, N.sum)
    )
  )

/**
 * Manhattan distance: `Σ |aᵢ − bᵢ|`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const manhattanDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number =>
  pipe(
    Chunk.zipWith(a, b, (ai, bi) => abs(N.subtract(ai, bi))),
    Chunk.reduce(0, N.sum)
  )

/**
 * Chebyshev distance: `max |aᵢ − bᵢ|`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const chebyshevDistance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number =>
  pipe(
    Chunk.zipWith(a, b, (ai, bi) => abs(N.subtract(ai, bi))),
    Chunk.reduce(0, N.max)
  )

/**
 * Elementwise midpoint: `(aᵢ + bᵢ) / 2`. Both chunks must have equal length.
 *
 * @since 0.1.0
 * @category internal
 */
export const midpoint = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): Chunk.Chunk<number> =>
  Chunk.zipWith(a, b, (ai, bi) => N.multiply(N.sum(ai, bi), 0.5))

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
  return Chunk.makeBy(dim, (j) =>
    N.multiply(
      Chunk.reduce(
        points,
        0,
        (acc, pt) => N.sum(acc, Option.getOrElse(Chunk.get(pt, j), () => 0))
      ),
      N.unsafeDivide(1, n)
    ))
}
