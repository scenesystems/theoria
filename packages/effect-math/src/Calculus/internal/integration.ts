/**
 * Composite quadrature kernels for numerical integration.
 *
 * Trapezoidal rule and Simpson's 1/3 rule for evenly-spaced samples.
 * Both operate on `Chunk<number>` and a scalar step size `dx`.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N } from "effect"

/**
 * Composite trapezoidal rule for evenly-spaced samples.
 *
 * ∫ ≈ dx · (y₀/2 + y₁ + y₂ + ... + y_{n−1} + yₙ/2)
 *
 * @since 0.1.0
 * @category internal
 */
export const trapezoidalRule = (values: Chunk.Chunk<number>, dx: number): number => {
  const n = N.subtract(Chunk.size(values), 1)
  const first = Chunk.unsafeGet(values, 0)
  const last = Chunk.unsafeGet(values, n)

  const interiorSum = Chunk.reduce(
    Chunk.drop(Chunk.take(values, n), 1),
    0,
    (acc, y) => N.sum(acc, y)
  )

  return N.multiply(
    dx,
    N.sum(
      N.sum(N.unsafeDivide(first, 2), interiorSum),
      N.unsafeDivide(last, 2)
    )
  )
}

/**
 * Composite Simpson's 1/3 rule for evenly-spaced samples.
 *
 * Requires an odd number of points (even number of intervals) for
 * pure Simpson's. When the number of intervals is odd, the last
 * interval is handled with the trapezoidal rule.
 *
 * @since 0.1.0
 * @category internal
 */
export const simpsonsRule = (values: Chunk.Chunk<number>, dx: number): number => {
  const size = Chunk.size(values)
  const intervals = N.subtract(size, 1)

  // Number of intervals that can be handled by Simpson's (must be even)
  const simpsonIntervals = N.remainder(intervals, 2) === 0 ? intervals : N.subtract(intervals, 1)
  const simpsonPoints = N.sum(simpsonIntervals, 1)

  const simpsonValues = Chunk.take(values, simpsonPoints)
  const simpsonResult = simpsonCore(simpsonValues, dx)

  if (simpsonIntervals === intervals) {
    return simpsonResult
  }

  // Handle the remaining last interval with trapezoidal rule
  const lastTwo = Chunk.drop(values, N.subtract(size, 2))
  const trapResult = trapezoidalRule(lastTwo, dx)

  return N.sum(simpsonResult, trapResult)
}

/**
 * Core Simpson's 1/3 computation for an odd number of points.
 *
 * S = (dx/3) · (y₀ + 4·y₁ + 2·y₂ + 4·y₃ + ... + 4·y_{n−1} + yₙ)
 */
const simpsonCore = (values: Chunk.Chunk<number>, dx: number): number => {
  const n = N.subtract(Chunk.size(values), 1)

  const weightedSum = Chunk.reduce(
    values,
    0,
    (acc, y, i) => {
      if (i === 0 || i === n) {
        return N.sum(acc, y)
      }
      const weight = N.remainder(i, 2) === 1 ? 4 : 2
      return N.sum(acc, N.multiply(weight, y))
    }
  )

  return N.multiply(N.unsafeDivide(dx, 3), weightedSum)
}
