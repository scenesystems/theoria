/**
 * Pure statistical estimator kernels over immutable Chunk carriers.
 *
 * @since 0.1.0
 * @category internal
 */
import { SemigroupMultiply, SemigroupSum } from "@effect/typeclass/data/Number"
import { Array, Boolean, Chunk, MutableRef, Number, Option } from "effect"
import { get, set } from "effect/MutableRef"
import { unsafeDivide } from "effect/Number"

import { abs, isFinite, sqrt } from "../../Numeric.js"
import { SummaryStatistics } from "../../Statistics.js"
import { max, min } from "../numeric/binary.js"

const sum = SemigroupSum.combine
const multiply = SemigroupMultiply.combine

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
    const nextCount = sum(index, 2)
    const currentAverage = get(average)
    const delta = sum(value, multiply(-1, currentAverage))
    const nextAverage = sum(currentAverage, unsafeDivide(delta, nextCount))
    const updatedDelta = sum(value, multiply(-1, nextAverage))
    set(maximum, max(get(maximum), value))
    set(average, nextAverage)
    set(minimum, min(get(minimum), value))
    set(sumOfSquaredDistances, sum(get(sumOfSquaredDistances), multiply(delta, updatedDelta)))
  })
  const finalCount = Chunk.size(values)
  const sampleVariance = Boolean.match(Number.Equivalence(finalCount, 1), {
    onTrue: () => 0,
    onFalse: () => unsafeDivide(get(sumOfSquaredDistances), Number.decrement(finalCount))
  })
  return new SummaryStatistics({
    count: finalCount,
    max: get(maximum),
    mean: get(average),
    min: get(minimum),
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
