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

/** Computes `log(exp(a) + exp(b))` without materializing large exponentials. */
export const logaddexp = (a: number, b: number): number =>
  Boolean.match(Number.Equivalence(a, b), {
    onTrue: () => Number.sum(a, lnTwo),
    onFalse: () => Number.sum(Binary.max(a, b), log1p(exp(Number.negate(Binary.abs(Number.subtract(a, b))))))
  })

/** Computes `log(exp(a) - exp(b))`; returns NaN outside the strict `a > b` domain. */
export const logsubexp = (a: number, b: number): number => Number.sum(a, log1mexp(Number.subtract(b, a)))

/** Computes `log(1 - exp(x))` on `x < 0` without cancellation. */
export const log1mexp = (x: number): number =>
  Boolean.match(belowNegativeLnTwo(x), {
    onTrue: () => log1p(Number.negate(exp(x))),
    onFalse: () =>
      Boolean.match(Number.Equivalence(x, 0), {
        onTrue: () => Binary.notANumber,
        onFalse: () => log(Number.negate(expm1(x)))
      })
  })

/** Computes softplus without overflowing its intermediate exponential. */
export const log1pexp = (x: number): number => Number.sum(Binary.max(x, 0), log1p(exp(Number.negate(Binary.abs(x)))))

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
