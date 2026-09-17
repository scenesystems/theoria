/**
 * Stable log-space arithmetic composed from Numeric transcendental kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Match, Number, Tuple } from "effect"

import * as Binary from "./binary.js"
import { exp, expm1, log, log1p } from "./transcendental.js"

const lnTwo = 0.6931471805599453

const addExponential = Match.type<readonly [number, number]>().pipe(
  Match.when(([a, b]) => Boolean.or(Binary.isNaN(a), Binary.isNaN(b)), () => Binary.notANumber),
  Match.when(([a]) => Number.Equivalence(a, Binary.negativeInfinity), ([, b]) => b),
  Match.when(([, b]) => Number.Equivalence(b, Binary.negativeInfinity), ([a]) => a),
  Match.when(
    ([a, b]) =>
      Boolean.or(Number.Equivalence(a, Binary.positiveInfinity), Number.Equivalence(b, Binary.positiveInfinity)),
    () => Binary.positiveInfinity
  ),
  Match.orElse(([a, b]) => {
    const maximum = Number.max(a, b)
    const minimum = Number.min(a, b)
    return Number.sum(maximum, log1p(exp(Number.subtract(minimum, maximum))))
  })
)

/** Computes `log(exp(a) + exp(b))` without materializing large exponentials. */
export const logaddexp = (a: number, b: number): number => addExponential(Tuple.make(a, b))

/** Computes `log(exp(a) - exp(b))`; returns NaN outside the strict `a > b` domain. */
export const logsubexp = (a: number, b: number): number =>
  Boolean.match(Number.greaterThan(a, b), {
    onTrue: () => {
      const exponential = exp(Number.subtract(b, a))
      return Number.sum(a, log1p(Number.negate(exponential)))
    },
    onFalse: () => Binary.notANumber
  })

/** Computes `log(1 - exp(x))` on `x < 0` without cancellation. */
export const log1mexp = Match.type<number>().pipe(
  Match.when(Number.greaterThanOrEqualTo(0), () => Binary.notANumber),
  Match.when(Number.greaterThan(Number.negate(lnTwo)), (x) => log(Number.negate(expm1(x)))),
  Match.orElse((x) => log1p(Number.negate(exp(x))))
)

/** Computes softplus without overflowing its intermediate exponential. */
export const log1pexp = Match.type<number>().pipe(
  Match.when(Number.greaterThan(33.3), (x) => x),
  Match.when(Number.greaterThan(-37), (x) => log1p(exp(x))),
  Match.orElse(exp)
)

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
