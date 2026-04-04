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
 * Descriptive statistics for a non-empty chunk using a one-pass Welford accumulator.
 *
 * Singleton chunks produce zero variance and standard deviation.
 *
 * @since 0.3.0
 * @category internal
 */
export const summaryStatistics = (values: Chunk.NonEmptyChunk<number>) => {
  const first = Chunk.headNonEmpty(values)
  const aggregated = Chunk.reduce(Chunk.tailNonEmpty(values), {
    count: 1,
    maximum: first,
    mean: first,
    minimum: first,
    sumOfSquaredDistances: 0
  }, (state, value) => {
    const count = state.count + 1
    const delta = value - state.mean
    const mean = state.mean + (delta / count)
    const deltaFromUpdatedMean = value - mean

    return {
      count,
      maximum: Math.max(state.maximum, value),
      mean,
      minimum: Math.min(state.minimum, value),
      sumOfSquaredDistances: state.sumOfSquaredDistances + (delta * deltaFromUpdatedMean)
    }
  })
  const variance = aggregated.count === 1
    ? 0
    : aggregated.sumOfSquaredDistances / (aggregated.count - 1)

  return {
    count: aggregated.count,
    maximum: aggregated.maximum,
    mean: aggregated.mean,
    minimum: aggregated.minimum,
    standardDeviation: Math.sqrt(variance),
    variance
  }
}

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
