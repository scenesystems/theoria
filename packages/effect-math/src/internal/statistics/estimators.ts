/**
 * Pure statistical estimator kernels over immutable Chunk carriers.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, Data, Number, Option, Schema } from "effect"

import { abs, sqrt } from "../../Numeric.js"
import { SummaryStatistics } from "../../Statistics.js"

class SummaryAccumulator extends Data.Class<{
  readonly count: number
  readonly maximum: number
  readonly mean: number
  readonly minimum: number
  readonly sumOfSquaredDistances: number
}> {}

const isFinite = Schema.is(Schema.Finite)

/** Arithmetic mean in observation order. */
export const mean = (values: Chunk.Chunk<number>): number => {
  const transientData = Chunk.toReadonlyArray(values)
  const scale = Array.reduce(
    transientData,
    0,
    (maximum, value) => {
      const magnitude = abs(value)
      return Number.sum(
        Number.max(maximum, magnitude),
        Number.subtract(magnitude, magnitude)
      )
    }
  )
  return Boolean.match(isFinite(scale), {
    onFalse: () => Number.unsafeDivide(Array.reduce(transientData, 0, Number.sum), Array.length(transientData)),
    onTrue: () =>
      Boolean.match(Number.Equivalence(scale, 0), {
        onTrue: () => Number.unsafeDivide(Array.reduce(transientData, 0, Number.sum), Array.length(transientData)),
        onFalse: () =>
          Number.multiply(
            Number.unsafeDivide(
              Array.reduce(transientData, 0, (sum, value) => Number.sum(sum, Number.unsafeDivide(value, scale))),
              Array.length(transientData)
            ),
            scale
          )
      })
  })
}

/** Bessel-corrected sample variance. */
export const variance = (values: Chunk.Chunk<number>): number => {
  const transientData = Chunk.toReadonlyArray(values)
  const average = mean(values)
  return Number.unsafeDivide(
    Array.reduce(transientData, 0, (sum, value) => {
      const distance = Number.subtract(value, average)
      return Number.sum(sum, Number.multiply(distance, distance))
    }),
    Number.decrement(Array.length(transientData))
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
  const transientB = Chunk.toReadonlyArray(b)
  const meanA = mean(a)
  const meanB = mean(b)
  return Number.unsafeDivide(
    Chunk.reduce(
      Chunk.take(a, Number.min(Chunk.size(a), Chunk.size(b))),
      0,
      (sum, left, index) =>
        Number.sum(
          sum,
          Number.multiply(
            Number.subtract(left, meanA),
            Number.subtract(Array.unsafeGet(transientB, index), meanB)
          )
        )
    ),
    Number.decrement(Chunk.size(a))
  )
}
