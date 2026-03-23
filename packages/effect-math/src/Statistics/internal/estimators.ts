/**
 * Pure statistical estimator kernels over Chunk carriers using Effect
 * primitives. All iteration uses `Chunk.reduce`, `Chunk.zipWith`, etc.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N, Option, pipe } from "effect"

/**
 * Arithmetic mean of a non-empty chunk.
 *
 * @since 0.1.0
 * @category internal
 */
export const mean = (values: Chunk.Chunk<number>): number =>
  N.unsafeDivide(Chunk.reduce(values, 0, N.sum), Chunk.size(values))

/**
 * Sample variance (Bessel-corrected, n-1 denominator).
 *
 * @since 0.1.0
 * @category internal
 */
export const variance = (values: Chunk.Chunk<number>): number => {
  const m = mean(values)
  const n = Chunk.size(values)
  return N.unsafeDivide(
    Chunk.reduce(values, 0, (acc, x) => {
      const diff = N.subtract(x, m)
      return N.sum(acc, N.multiply(diff, diff))
    }),
    N.subtract(n, 1)
  )
}

/**
 * Sample standard deviation — `√(variance)`.
 *
 * `Math.sqrt` is a deterministic IEEE 754 primitive — no Effect equivalent
 * exists. Used here as a leaf mathematical operation.
 *
 * @since 0.1.0
 * @category internal
 */
export const standardDeviation = (values: Chunk.Chunk<number>): number => Math.sqrt(variance(values))

/**
 * Minimum of a chunk, returns `Option.none()` for empty.
 *
 * @since 0.1.0
 * @category internal
 */
export const minimum = (values: Chunk.Chunk<number>): Option.Option<number> =>
  Chunk.size(values) === 0
    ? Option.none()
    : Option.some(
      Chunk.reduce(
        Chunk.drop(values, 1),
        Option.getOrElse(Chunk.get(values, 0), () => 0),
        N.min
      )
    )

/**
 * Maximum of a chunk, returns `Option.none()` for empty.
 *
 * @since 0.1.0
 * @category internal
 */
export const maximum = (values: Chunk.Chunk<number>): Option.Option<number> =>
  Chunk.size(values) === 0
    ? Option.none()
    : Option.some(
      Chunk.reduce(
        Chunk.drop(values, 1),
        Option.getOrElse(Chunk.get(values, 0), () => 0),
        N.max
      )
    )

/**
 * Covariance of two equal-length chunks (Bessel-corrected, n-1 denominator).
 *
 * @since 0.1.0
 * @category internal
 */
export const covariance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number => {
  const meanA = mean(a)
  const meanB = mean(b)
  const n = Chunk.size(a)
  return N.unsafeDivide(
    pipe(
      Chunk.zipWith(a, b, (ai, bi) => N.multiply(N.subtract(ai, meanA), N.subtract(bi, meanB))),
      Chunk.reduce(0, N.sum)
    ),
    N.subtract(n, 1)
  )
}
