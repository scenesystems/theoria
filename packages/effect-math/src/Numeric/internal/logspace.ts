/**
 * Log-space arithmetic kernels for numerically stable log-probability
 * computations. All functions avoid overflow/underflow by operating in
 * log-space throughout.
 *
 * @since 0.1.0
 * @category internal
 */

import { Boolean, Match, Number as N, Schema } from "effect"

const NEGATIVE_INFINITY = N.negate(Infinity)
const isNonNaN = Schema.is(Schema.NonNaN)

const bothNonNaN = (a: number, b: number): boolean => Boolean.and(isNonNaN(a), isNonNaN(b))

/**
 * log(exp(a) + exp(b)) without overflow. Uses max-shift trick:
 * max(a,b) + log1p(exp(-|a - b|)).
 *
 * @since 0.1.0
 * @category internal
 */
export const logaddexp = (a: number, b: number): number => {
  return Match.value(bothNonNaN(a, b)).pipe(
    Match.when(false, () => NaN),
    Match.when(true, () =>
      Match.value(a).pipe(
        Match.when(NEGATIVE_INFINITY, () => b),
        Match.when(Infinity, () => Infinity),
        Match.orElse(() =>
          Match.value(b).pipe(
            Match.when(NEGATIVE_INFINITY, () => a),
            Match.when(Infinity, () => Infinity),
            Match.orElse(() => {
              const max = N.max(a, b)
              const min = N.min(a, b)
              return N.sum(max, Math.log1p(Math.exp(N.subtract(min, max))))
            })
          )
        )
      )),
    Match.exhaustive
  )
}

/**
 * log(exp(a) - exp(b)) for a > b. Returns NaN when b >= a.
 * Uses a + log1p(-exp(b - a)).
 *
 * @since 0.1.0
 * @category internal
 */
export const logsubexp = (a: number, b: number): number => {
  return Match.value(bothNonNaN(a, b)).pipe(
    Match.when(false, () => NaN),
    Match.when(true, () =>
      Match.value(N.greaterThanOrEqualTo(b, a)).pipe(
        Match.when(true, () => NaN),
        Match.when(false, () => N.sum(a, Math.log1p(N.negate(Math.exp(N.subtract(b, a)))))),
        Match.exhaustive
      )),
    Match.exhaustive
  )
}

/**
 * log(1 - exp(x)) for x < 0. Branches at x = -ln(2) ≈ -0.6931:
 * - x > -ln(2): log(-expm1(x))
 * - x ≤ -ln(2): log1p(-exp(x))
 *
 * @since 0.1.0
 * @category internal
 */
export const log1mexp = (x: number): number => {
  return Match.value(isNonNaN(x)).pipe(
    Match.when(false, () => NaN),
    Match.when(true, () =>
      Match.value(N.greaterThanOrEqualTo(x, 0)).pipe(
        Match.when(true, () => NaN),
        Match.when(false, () =>
          Match.value(N.greaterThan(x, N.negate(Math.LN2))).pipe(
            Match.when(true, () => Math.log(N.negate(Math.expm1(x)))),
            Match.when(false, () => Math.log1p(N.negate(Math.exp(x)))),
            Match.exhaustive
          )),
        Match.exhaustive
      )),
    Match.exhaustive
  )
}

/**
 * log(1 + exp(x)) (softplus). Branches for numerical stability:
 * - x > 33.3: x (exp(x) dominates, log1p ≈ x)
 * - x > -37: log1p(exp(x))
 * - x ≤ -37: exp(x) (log1p(tiny) ≈ tiny)
 *
 * @since 0.1.0
 * @category internal
 */
export const log1pexp = (x: number): number => {
  return Match.value(isNonNaN(x)).pipe(
    Match.when(false, () => Math.exp(x)),
    Match.when(true, () =>
      Match.value(N.greaterThan(x, 33.3)).pipe(
        Match.when(true, () => x),
        Match.when(false, () =>
          Match.value(N.greaterThan(x, N.negate(37))).pipe(
            Match.when(true, () => Math.log1p(Math.exp(x))),
            Match.when(false, () => Math.exp(x)),
            Match.exhaustive
          )),
        Match.exhaustive
      )),
    Match.exhaustive
  )
}

/**
 * x * log(y) with x=0 → 0 convention (avoids 0 * -Infinity = NaN).
 *
 * @since 0.1.0
 * @category internal
 */
export const xlogy = (x: number, y: number): number =>
  Match.value(N.Equivalence(x, 0)).pipe(
    Match.when(true, () => 0),
    Match.when(false, () => N.multiply(x, Math.log(y))),
    Match.exhaustive
  )

/**
 * x * log(1 + y) with x=0 → 0 convention.
 *
 * @since 0.1.0
 * @category internal
 */
export const xlog1py = (x: number, y: number): number =>
  Match.value(N.Equivalence(x, 0)).pipe(
    Match.when(true, () => 0),
    Match.when(false, () => N.multiply(x, Math.log1p(y))),
    Match.exhaustive
  )
