/**
 * Stable log-space arithmetic composed from Numeric transcendental kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Function, Number } from "effect"

import * as Binary from "./binary.js"
import { exp, expm1, log, log1p } from "./transcendental.js"

const lnTwo = 0.6931471805599453
const belowNegativeLnTwo = Number.lessThan(Number.negate(lnTwo))

const equalLogWeights = (a: number, _b: number): number => Number.sum(a, lnTwo)
const unequalLogWeights = (a: number, b: number): number =>
  Number.sum(Binary.max(a, b), log1p(exp(Number.negate(Binary.abs(Number.subtract(a, b))))))
const selectLogWeights = Boolean.match({ onTrue: () => equalLogWeights, onFalse: () => unequalLogWeights })

/** Computes `log(exp(a) + exp(b))` without materializing large exponentials. */
export const logaddexp = (a: number, b: number): number => selectLogWeights(Number.Equivalence(a, b))(a, b)

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
