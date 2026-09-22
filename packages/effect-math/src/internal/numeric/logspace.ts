/**
 * Stable log-space arithmetic composed from Numeric transcendental kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { SemigroupMultiply, SemigroupSum } from "@effect/typeclass/data/Number"
import { Number } from "effect"
import { Equivalence, unsafeDivide } from "effect/Number"

import { exp, expm1, log, log1p } from "./transcendental.js"

const sum = SemigroupSum.combine
const multiply = SemigroupMultiply.combine
const lnTwo = 0.6931471805599453

/** Computes `log(exp(a) + exp(b))` without materializing large exponentials. */
export const logaddexp = (a: number, b: number): number => {
  const ordering = Number.Order(a, b)
  if (ordering === 0) return sum(a, lnTwo)
  if (ordering === 1) return sum(a, log1p(exp(sum(b, multiply(a, -1)))))
  return sum(b, log1p(exp(sum(a, multiply(b, -1)))))
}

/** Computes `log(exp(a) - exp(b))`; returns NaN outside the strict `a > b` domain. */
export const logsubexp = (a: number, b: number): number => {
  const difference = sum(b, multiply(a, -1))
  if (Equivalence(Number.Order(difference, -0.6931471805599453), -1)) {
    return sum(a, log1p(multiply(-1, exp(difference))))
  }
  if (Equivalence(difference, 0)) return unsafeDivide(difference, difference)
  return sum(a, log(multiply(-1, expm1(difference))))
}

/** Computes `log(1 - exp(x))` on `x < 0` without cancellation. */
export const log1mexp = (x: number): number => {
  if (x < -0.6931471805599453) return log1p(multiply(-1, exp(x)))
  if (Equivalence(x, 0)) return unsafeDivide(x, x)
  return log(multiply(-1, expm1(x)))
}

/**
 * Computes softplus without overflowing its intermediate exponential.
 * The omitted corrections in either tail are below binary64 rounding precision.
 */
export const log1pexp = (x: number): number => {
  if (x > 33.3) return x
  if (x > -37) return log1p(exp(x))
  return exp(x)
}

/** Computes `x * log(y)` with the conventional zero multiplier. */
export const xlogy = (x: number, y: number): number => {
  if (Number.Equivalence(x, 0)) return 0
  return multiply(x, log(y))
}

/** Computes `x * log(1 + y)` with the conventional zero multiplier. */
export const xlog1py = (x: number, y: number): number => {
  if (Number.Equivalence(x, 0)) return 0
  return multiply(x, log1p(y))
}
