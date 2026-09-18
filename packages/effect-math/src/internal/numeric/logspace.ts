/**
 * Stable log-space arithmetic composed from Numeric transcendental kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number } from "effect"

import * as Binary from "./binary.js"
import { exp, expm1, log, log1p } from "./transcendental.js"

const lnTwo = 0.6931471805599453

/** Computes `log(exp(a) + exp(b))` without materializing large exponentials. */
export const logaddexp = (a: number, b: number): number => {
  const difference = Number.subtract(a, b)
  return Boolean.match(Binary.isNaN(difference), {
    onTrue: () =>
      Boolean.match(Boolean.or(Binary.isNaN(a), Binary.isNaN(b)), {
        onTrue: () => Binary.notANumber,
        onFalse: () => a
      }),
    onFalse: () =>
      Boolean.match(Number.greaterThan(difference, 0), {
        onTrue: () => Number.sum(a, log1p(exp(Number.negate(difference)))),
        onFalse: () => Number.sum(b, log1p(exp(difference)))
      })
  })
}

/** Computes `log(exp(a) - exp(b))`; returns NaN outside the strict `a > b` domain. */
export const logsubexp = (a: number, b: number): number =>
  Boolean.match(Number.greaterThan(a, b), {
    onTrue: () => Number.sum(a, log1mexp(Number.subtract(b, a))),
    onFalse: () => Binary.notANumber
  })

/** Computes `log(1 - exp(x))` on `x < 0` without cancellation. */
export const log1mexp = (x: number): number =>
  Boolean.match(Number.lessThan(x, Number.negate(lnTwo)), {
    onTrue: () => log1p(Number.negate(exp(x))),
    onFalse: () =>
      Boolean.match(Number.lessThan(x, 0), {
        onTrue: () => log(Number.negate(expm1(x))),
        onFalse: () => Binary.notANumber
      })
  })

/** Computes softplus without overflowing its intermediate exponential. */
export const log1pexp = (x: number): number =>
  Boolean.match(Number.greaterThan(x, 33.3), {
    onTrue: () => x,
    onFalse: () =>
      Boolean.match(Number.greaterThan(x, -37), {
        onTrue: () => log1p(exp(x)),
        onFalse: () => exp(x)
      })
  })

/** Computes `x * log(y)` with the conventional zero multiplier. */
export const xlogy = (x: number, y: number): number =>
  Boolean.match(Number.Equivalence(x, 0), {
    onTrue: () => 0,
    onFalse: () => Number.multiply(x, log(y))
  })

/** Computes `x * log(1 + y)` with the conventional zero multiplier. */
export const xlog1py = (x: number, y: number): number =>
  Boolean.match(Number.Equivalence(x, 0), {
    onTrue: () => 0,
    onFalse: () => Number.multiply(x, log1p(y))
  })
