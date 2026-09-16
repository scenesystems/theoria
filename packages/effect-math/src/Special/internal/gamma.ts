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
import { Boolean, Chunk, Number } from "effect"

import { exp, log, pi, pow, sin, sqrt } from "../../Numeric/index.js"

const LANCZOS_G = 7

const LANCZOS_COEFFICIENTS: Chunk.Chunk<number> = Chunk.make(
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7
)

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
      const t = Number.sum(xShifted, Number.sum(LANCZOS_G, 0.5))
      const seriesSum = Chunk.reduce(
        Chunk.drop(LANCZOS_COEFFICIENTS, 1),
        Chunk.unsafeGet(LANCZOS_COEFFICIENTS, 0),
        (acc, coeff, index) => Number.sum(acc, Number.unsafeDivide(coeff, Number.sum(xShifted, Number.sum(index, 1))))
      )
      return Number.multiply(
        Number.multiply(sqrt(Number.multiply(2, pi)), seriesSum),
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
      const t = Number.sum(xShifted, Number.sum(LANCZOS_G, 0.5))
      const seriesSum = Chunk.reduce(
        Chunk.drop(LANCZOS_COEFFICIENTS, 1),
        Chunk.unsafeGet(LANCZOS_COEFFICIENTS, 0),
        (acc, coeff, index) => Number.sum(acc, Number.unsafeDivide(coeff, Number.sum(xShifted, Number.sum(index, 1))))
      )
      return Number.sum(
        Number.sum(
          log(Number.multiply(sqrt(Number.multiply(2, pi)), seriesSum)),
          Number.multiply(Number.sum(xShifted, 0.5), log(t))
        ),
        Number.negate(t)
      )
    }
  })
}
