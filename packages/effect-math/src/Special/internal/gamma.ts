/**
 * Lanczos approximation for the gamma function and its logarithm.
 *
 * Uses g = 7 with 9 coefficients (Godfrey, 2001; GNU Scientific Library).
 * Reflection formula Γ(x)·Γ(1−x) = π/sin(πx) handles x < 0.5.
 * `Math.sqrt`, `Math.exp`, `Math.log`, `Math.sin`, `Math.PI` are
 * deterministic IEEE 754 leaf operations used here as mathematical
 * primitives — they never appear in the public API surface.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N } from "effect"

const LANCZOS_G = 7

const LANCZOS_COEFFICIENTS: Chunk.Chunk<number> = Chunk.fromIterable([
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7
])

/**
 * Γ(x) via Lanczos approximation with reflection formula for x < 0.5.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaLanczos = (x: number): number => {
  if (x < 0.5) {
    return Math.PI / (Math.sin(N.multiply(Math.PI, x)) * gammaLanczos(N.subtract(1, x)))
  }

  const xShifted = N.subtract(x, 1)
  const t = N.sum(xShifted, N.sum(LANCZOS_G, 0.5))

  const seriesSum = Chunk.reduce(
    Chunk.drop(LANCZOS_COEFFICIENTS, 1),
    Chunk.unsafeGet(LANCZOS_COEFFICIENTS, 0),
    (acc, coeff, i) => N.sum(acc, coeff / N.sum(xShifted, N.sum(i, 1)))
  )

  return N.multiply(
    N.multiply(Math.sqrt(N.multiply(2, Math.PI)), seriesSum),
    Math.pow(t, N.sum(xShifted, 0.5)) * Math.exp(N.negate(t))
  )
}

/**
 * ln(Γ(x)) via Lanczos approximation — avoids overflow for large x.
 * Requires x > 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const lnGammaLanczos = (x: number): number => {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(N.multiply(Math.PI, x))) - lnGammaLanczos(N.subtract(1, x))
  }

  const xShifted = N.subtract(x, 1)
  const t = N.sum(xShifted, N.sum(LANCZOS_G, 0.5))

  const seriesSum = Chunk.reduce(
    Chunk.drop(LANCZOS_COEFFICIENTS, 1),
    Chunk.unsafeGet(LANCZOS_COEFFICIENTS, 0),
    (acc, coeff, i) => N.sum(acc, coeff / N.sum(xShifted, N.sum(i, 1)))
  )

  return N.sum(
    N.sum(
      Math.log(N.multiply(Math.sqrt(N.multiply(2, Math.PI)), seriesSum)),
      N.multiply(N.sum(xShifted, 0.5), Math.log(t))
    ),
    N.negate(t)
  )
}
