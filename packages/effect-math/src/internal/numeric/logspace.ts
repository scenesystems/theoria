/**
 * Stable log-space arithmetic composed from Numeric transcendental kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { SemigroupMultiply, SemigroupSum } from "@effect/typeclass/data/Number"
import { Boolean, Function, Number } from "effect"

import { exp, expm1, log, log1p } from "./transcendental.js"

const sum = SemigroupSum.combine
const multiply = SemigroupMultiply.combine
const lnTwo = 0.6931471805599453
const belowNegativeLnTwo = Number.lessThan(Number.negate(lnTwo))

/** Computes `log(exp(a) + exp(b))` without materializing large exponentials. */
export const logaddexp = (a: number, b: number): number => {
  const ordering = Number.Order(a, b)
  if (ordering === 0) return sum(a, lnTwo)
  if (ordering === 1) return sum(a, log1p(exp(sum(b, multiply(a, -1)))))
  return sum(b, log1p(exp(sum(a, multiply(b, -1)))))
}

/** Computes `log(exp(a) - exp(b))`; returns NaN outside the strict `a > b` domain. */
export const logsubexp = (a: number, b: number): number => Number.sum(a, log1mexp(Number.subtract(b, a)))

const log1mexpFar = (x: number): number => log1p(Number.negate(exp(x)))
const log1mexpNear = (x: number): number =>
  // x/x is exactly one for every finite nonzero x, including subnormals.
  // At zero it rejects the excluded endpoint with NaN rather than -Infinity.
  log(Number.multiply(Number.negate(expm1(x)), Number.unsafeDivide(x, x)))
const selectLog1mexp = Boolean.match({ onTrue: () => log1mexpFar, onFalse: () => log1mexpNear })

/** Computes `log(1 - exp(x))` on `x < 0` without cancellation. */
export const log1mexp = (x: number): number => selectLog1mexp(belowNegativeLnTwo(x))(x)

/**
 * Computes softplus without overflowing its intermediate exponential.
 * The omitted corrections in either tail are below binary64 rounding precision.
 */
export const log1pexp = (x: number): number => {
  if (x > 33.3) return x
  if (x > -37) return log1p(exp(x))
  return exp(x)
}

const zeroProduct = Function.constant(0)
const logarithmicProduct = (x: number, y: number): number => Number.multiply(x, log(y))
const logarithmicIncrementProduct = (x: number, y: number): number => Number.multiply(x, log1p(y))
const selectLogarithmicProduct = Boolean.match({
  onTrue: () => zeroProduct,
  onFalse: () => logarithmicProduct
})
const selectLogarithmicIncrementProduct = Boolean.match({
  onTrue: () => zeroProduct,
  onFalse: () => logarithmicIncrementProduct
})

/** Computes `x * log(y)` with the conventional zero multiplier. */
export const xlogy = (x: number, y: number): number => selectLogarithmicProduct(Number.Equivalence(x, 0))(x, y)

/** Computes `x * log(1 + y)` with the conventional zero multiplier. */
export const xlog1py = (x: number, y: number): number =>
  selectLogarithmicIncrementProduct(Number.Equivalence(x, 0))(x, y)
