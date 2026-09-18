/**
 * Lanczos approximation for the gamma function and its logarithm.
 *
 * Uses g = 7 with 9 coefficients (Godfrey, 2001; GNU Scientific Library).
 * Reflection formula Γ(x)·Γ(1−x) = π/sin(πx) handles x < 0.5.
 * Transcendental operations are composed through the public Numeric API.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number } from "effect"

import { exp, log, pi, pow, sin, sqrt } from "../../Numeric.js"

const lanczosG = 7
const lanczosOffset = Number.sum(lanczosG, 0.5)
const sqrtTwoPi = sqrt(Number.multiply(2, pi))

// Preserve the original left-to-right coefficient accumulation while avoiding
// a collection traversal and coefficient-tail allocation for every call.
const lanczosSeries = (xShifted: number): number => {
  const sum1 = Number.sum(
    0.99999999999980993,
    Number.unsafeDivide(676.5203681218851, Number.sum(xShifted, 1))
  )
  const sum2 = Number.sum(sum1, Number.unsafeDivide(-1259.1392167224028, Number.sum(xShifted, 2)))
  const sum3 = Number.sum(sum2, Number.unsafeDivide(771.32342877765313, Number.sum(xShifted, 3)))
  const sum4 = Number.sum(sum3, Number.unsafeDivide(-176.61502916214059, Number.sum(xShifted, 4)))
  const sum5 = Number.sum(sum4, Number.unsafeDivide(12.507343278686905, Number.sum(xShifted, 5)))
  const sum6 = Number.sum(sum5, Number.unsafeDivide(-0.13857109526572012, Number.sum(xShifted, 6)))
  const sum7 = Number.sum(sum6, Number.unsafeDivide(9.9843695780195716e-6, Number.sum(xShifted, 7)))
  return Number.sum(sum7, Number.unsafeDivide(1.5056327351493116e-7, Number.sum(xShifted, 8)))
}

/**
 * Γ(x) via Lanczos approximation with reflection formula for x < 0.5.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaLanczos = (x: number): number => {
  return Boolean.match(Number.lessThan(x, 0.5), {
    onTrue: () =>
      Number.unsafeDivide(
        pi,
        Number.multiply(sin(Number.multiply(pi, x)), gammaLanczos(Number.subtract(1, x)))
      ),
    onFalse: () => {
      const xShifted = Number.subtract(x, 1)
      const t = Number.sum(xShifted, lanczosOffset)
      const seriesSum = lanczosSeries(xShifted)
      return Number.multiply(
        Number.multiply(sqrtTwoPi, seriesSum),
        Number.multiply(pow(t, Number.sum(xShifted, 0.5)), exp(Number.negate(t)))
      )
    }
  })
}

/**
 * ln(Γ(x)) via Lanczos approximation — avoids overflow for large x.
 * Requires x > 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const lnGammaLanczos = (x: number): number => {
  return Boolean.match(Number.lessThan(x, 0.5), {
    onTrue: () =>
      Number.subtract(
        log(Number.unsafeDivide(pi, sin(Number.multiply(pi, x)))),
        lnGammaLanczos(Number.subtract(1, x))
      ),
    onFalse: () => {
      const xShifted = Number.subtract(x, 1)
      const t = Number.sum(xShifted, lanczosOffset)
      const seriesSum = lanczosSeries(xShifted)
      return Number.sum(
        Number.sum(
          log(Number.multiply(sqrtTwoPi, seriesSum)),
          Number.multiply(Number.sum(xShifted, 0.5), log(t))
        ),
        Number.negate(t)
      )
    }
  })
}
