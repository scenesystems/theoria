/**
 * Composite quadrature kernels for numerical integration.
 *
 * Trapezoidal rule and Simpson's 1/3 rule for evenly-spaced samples.
 * Both operate on `Chunk<number>` and a scalar step size `dx`.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Number } from "effect"

const NOT_A_NUMBER = Number.unsafeDivide(0, 0)

/**
 * Composite trapezoidal rule for evenly-spaced samples.
 *
 * @remarks
 * ∫ ≈ dx · (y₀/2 + y₁ + y₂ + ... + y_{n−1} + yₙ/2)
 *
 * @since 0.1.0
 * @category internal
 */
export const trapezoidalRule = (values: Chunk.Chunk<number>, dx: number): number => {
  const hasEnoughSamples = Number.greaterThanOrEqualTo(Chunk.size(values), 2)
  return Boolean.match(hasEnoughSamples, {
    onFalse: () => NOT_A_NUMBER,
    onTrue: () => {
      const n = Number.decrement(Chunk.size(values))
      const first = Chunk.unsafeGet(values, 0)
      const last = Chunk.unsafeGet(values, n)
      const interiorSum = Chunk.reduce(
        Chunk.drop(Chunk.take(values, n), 1),
        0,
        Number.sum
      )

      return Number.multiply(
        dx,
        Number.sum(
          Number.sum(Number.unsafeDivide(first, 2), interiorSum),
          Number.unsafeDivide(last, 2)
        )
      )
    }
  })
}

/**
 * Composite Simpson's 1/3 rule for evenly-spaced samples.
 *
 * @remarks
 * Requires an odd number of points (even number of intervals) for
 * pure Simpson's. When the number of intervals is odd, the last
 * interval is handled with the trapezoidal rule.
 *
 * @since 0.1.0
 * @category internal
 */
export const simpsonsRule = (values: Chunk.Chunk<number>, dx: number): number => {
  const size = Chunk.size(values)
  return Boolean.match(Number.lessThan(size, 2), {
    onTrue: () => NOT_A_NUMBER,
    onFalse: () =>
      Boolean.match(Number.Equivalence(size, 2), {
        onTrue: () => trapezoidalRule(values, dx),
        onFalse: () => {
          const intervals = Number.decrement(size)
          const evenIntervals = Number.Equivalence(Number.remainder(intervals, 2), 0)
          const simpsonIntervals = Boolean.match(evenIntervals, {
            onTrue: () => intervals,
            onFalse: () => Number.decrement(intervals)
          })
          const simpsonResult = simpsonCore(Chunk.take(values, Number.increment(simpsonIntervals)), dx)

          return Boolean.match(evenIntervals, {
            onTrue: () => simpsonResult,
            onFalse: () =>
              Number.sum(
                simpsonResult,
                trapezoidalRule(Chunk.drop(values, Number.subtract(size, 2)), dx)
              )
          })
        }
      })
  })
}

/**
 * Core Simpson's 1/3 computation for an odd number of points.
 *
 * S = (dx/3) · (y₀ + 4·y₁ + 2·y₂ + 4·y₃ + ... + 4·y_{n−1} + yₙ)
 */
const simpsonCore = (values: Chunk.Chunk<number>, dx: number): number => {
  const n = Number.subtract(Chunk.size(values), 1)

  const weightedSum = Chunk.reduce(
    values,
    0,
    (acc, y, i) =>
      Boolean.match(Boolean.or(Number.Equivalence(i, 0), Number.Equivalence(i, n)), {
        onTrue: () => Number.sum(acc, y),
        onFalse: () =>
          Number.sum(
            acc,
            Number.multiply(
              Boolean.match(Number.Equivalence(Number.remainder(i, 2), 1), {
                onTrue: () => 4,
                onFalse: () => 2
              }),
              y
            )
          )
      })
  )

  return Number.multiply(Number.unsafeDivide(dx, 3), weightedSum)
}
