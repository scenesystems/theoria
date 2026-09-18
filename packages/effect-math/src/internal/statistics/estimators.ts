/**
 * Pure statistical estimator kernels over immutable Chunk carriers.
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, MutableRef, Number, Option } from "effect"

import { abs, isFinite, sqrt } from "../../Numeric.js"
import { SummaryStatistics } from "../../Statistics.js"

const meanArray = (values: ReadonlyArray<number>): number => {
  const total = Number.sumAll(values)
  const count = Array.length(values)
  return Boolean.match(isFinite(total), {
    onTrue: () => Number.unsafeDivide(total, count),
    onFalse: () => {
      // Scale only when a finite sum overflows. Dividing every observation
      // first would lose subnormal contributions even when their mean fits.
      const scale = Array.reduce(values, 0, (maximum, value) => {
        const magnitude = abs(value)
        return Number.sum(Number.max(maximum, magnitude), Number.subtract(magnitude, magnitude))
      })
      return Boolean.match(isFinite(scale), {
        onFalse: () => Number.unsafeDivide(total, count),
        onTrue: () =>
          Number.multiply(
            Number.unsafeDivide(
              Array.reduce(values, 0, (sum, value) => Number.sum(sum, Number.unsafeDivide(value, scale))),
              count
            ),
            scale
          )
      })
    }
  })
}

/** Arithmetic mean in observation order. */
export const mean = (values: Chunk.Chunk<number>): number => meanArray(Chunk.toReadonlyArray(values))

/** Bessel-corrected sample variance. */
export const variance = (values: Chunk.Chunk<number>): number => {
  const transientData = Chunk.toReadonlyArray(values)
  const average = meanArray(transientData)
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
  const maximum = MutableRef.make(first)
  const average = MutableRef.make(first)
  const minimum = MutableRef.make(first)
  const sumOfSquaredDistances = MutableRef.make(0)
  Chunk.forEach(Chunk.tailNonEmpty(values), (value, index) => {
    const nextCount = Number.sum(index, 2)
    const currentAverage = MutableRef.get(average)
    const delta = Number.subtract(value, currentAverage)
    const nextAverage = Number.sum(currentAverage, Number.unsafeDivide(delta, nextCount))
    const updatedDelta = Number.subtract(value, nextAverage)
    MutableRef.set(maximum, Number.max(MutableRef.get(maximum), value))
    MutableRef.set(average, nextAverage)
    MutableRef.set(minimum, Number.min(MutableRef.get(minimum), value))
    MutableRef.set(
      sumOfSquaredDistances,
      Number.sum(MutableRef.get(sumOfSquaredDistances), Number.multiply(delta, updatedDelta))
    )
  })
  const finalCount = Chunk.size(values)
  const sampleVariance = Boolean.match(Number.Equivalence(finalCount, 1), {
    onTrue: () => 0,
    onFalse: () => Number.unsafeDivide(MutableRef.get(sumOfSquaredDistances), Number.decrement(finalCount))
  })
  return new SummaryStatistics({
    count: finalCount,
    max: MutableRef.get(maximum),
    mean: MutableRef.get(average),
    min: MutableRef.get(minimum),
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
  const transientA = Chunk.toReadonlyArray(a)
  const transientB = Chunk.toReadonlyArray(b)
  const meanA = meanArray(transientA)
  const meanB = meanArray(transientB)
  const pairedA = Boolean.match(Number.lessThanOrEqualTo(Array.length(transientA), Array.length(transientB)), {
    onTrue: () => transientA,
    onFalse: () => Array.take(transientA, Array.length(transientB))
  })
  return Number.unsafeDivide(
    Array.reduce(
      pairedA,
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
    Number.decrement(Array.length(transientA))
  )
}
