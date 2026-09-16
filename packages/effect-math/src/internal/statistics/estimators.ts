/**
 * Pure statistical estimator kernels over immutable Chunk carriers.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Data, Number, Option, pipe, Schema } from "effect"

import { abs, sqrt } from "../../Numeric.js"
import { SummaryStatistics } from "../../Statistics.js"

class SummaryAccumulator extends Data.Class<{
  readonly count: number
  readonly maximum: number
  readonly mean: number
  readonly minimum: number
  readonly sumOfSquaredDistances: number
}> {}

/** Arithmetic mean in observation order. */
export const mean = (values: Chunk.Chunk<number>): number =>
  Boolean.match(Chunk.every(values, Schema.is(Schema.Finite)), {
    onFalse: () => Number.unsafeDivide(Chunk.reduce(values, 0, Number.sum), Chunk.size(values)),
    onTrue: () => {
      const scale = Chunk.reduce(values, 0, (maximum, value) => Number.max(maximum, abs(value)))
      return Boolean.match(Number.Equivalence(scale, 0), {
        onTrue: () => Number.unsafeDivide(Chunk.reduce(values, 0, Number.sum), Chunk.size(values)),
        onFalse: () =>
          Number.multiply(
            Number.unsafeDivide(
              Chunk.reduce(values, 0, (sum, value) => Number.sum(sum, Number.unsafeDivide(value, scale))),
              Chunk.size(values)
            ),
            scale
          )
      })
    }
  })

/** Bessel-corrected sample variance. */
export const variance = (values: Chunk.Chunk<number>): number => {
  const average = mean(values)
  return Number.unsafeDivide(
    Chunk.reduce(values, 0, (sum, value) => {
      const distance = Number.subtract(value, average)
      return Number.sum(sum, Number.multiply(distance, distance))
    }),
    Number.decrement(Chunk.size(values))
  )
}

/** Square root of the Bessel-corrected sample variance. */
export const standardDeviation = (values: Chunk.Chunk<number>): number => sqrt(variance(values))

/** Descriptive statistics from a one-pass Welford fold. */
export const summaryStatistics = (values: Chunk.NonEmptyChunk<number>): SummaryStatistics => {
  const first = Chunk.headNonEmpty(values)
  const accumulated = Chunk.reduce(
    Chunk.tailNonEmpty(values),
    new SummaryAccumulator({
      count: 1,
      maximum: first,
      mean: first,
      minimum: first,
      sumOfSquaredDistances: 0
    }),
    (state, value) => {
      const count = Number.increment(state.count)
      const delta = Number.subtract(value, state.mean)
      const average = Number.sum(state.mean, Number.unsafeDivide(delta, count))
      const updatedDelta = Number.subtract(value, average)
      return new SummaryAccumulator({
        count,
        maximum: Number.max(state.maximum, value),
        mean: average,
        minimum: Number.min(state.minimum, value),
        sumOfSquaredDistances: Number.sum(
          state.sumOfSquaredDistances,
          Number.multiply(delta, updatedDelta)
        )
      })
    }
  )
  const sampleVariance = Boolean.match(Number.Equivalence(accumulated.count, 1), {
    onTrue: () => 0,
    onFalse: () => Number.unsafeDivide(accumulated.sumOfSquaredDistances, Number.decrement(accumulated.count))
  })
  return new SummaryStatistics({
    count: accumulated.count,
    max: accumulated.maximum,
    mean: accumulated.mean,
    min: accumulated.minimum,
    standardDeviation: sqrt(sampleVariance),
    variance: sampleVariance
  })
}

/** Minimum observation, or None for an empty sample. */
export const minimum = (values: Chunk.Chunk<number>): Option.Option<number> =>
  Option.map(Chunk.head(values), (head) => Chunk.reduce(Chunk.drop(values, 1), head, Number.min))

/** Maximum observation, or None for an empty sample. */
export const maximum = (values: Chunk.Chunk<number>): Option.Option<number> =>
  Option.map(Chunk.head(values), (head) => Chunk.reduce(Chunk.drop(values, 1), head, Number.max))

/** Bessel-corrected covariance over the shared sample prefix. */
export const covariance = (a: Chunk.Chunk<number>, b: Chunk.Chunk<number>): number => {
  const meanA = mean(a)
  const meanB = mean(b)
  return Number.unsafeDivide(
    pipe(
      Chunk.zipWith(
        a,
        b,
        (left, right) => Number.multiply(Number.subtract(left, meanA), Number.subtract(right, meanB))
      ),
      Chunk.reduce(0, Number.sum)
    ),
    Number.decrement(Chunk.size(a))
  )
}
