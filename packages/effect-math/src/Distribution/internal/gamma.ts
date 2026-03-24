/**
 * Gamma distribution kernels.
 * Parameters: shape (k > 0), scale (θ > 0). Mean = kθ.
 *
 * CDF delegates to gammainc from Special/internal/gammainc.js.
 * Log-normalisation uses lnGamma from Special/internal/gamma.js.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { digammaKernel } from "../../Special/internal/digamma.js"
import { lnGammaLanczos } from "../../Special/internal/gamma.js"
import { gammaincKernel } from "../../Special/internal/gammainc.js"

/**
 * Gamma PDF: x^{k−1} e^{−x/θ} / (θ^k Γ(k)) for x > 0.
 *
 * Handles x = 0 with shape = 1 as the limiting density 1/θ.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaPdf = (x: number, shape: number, scale: number): number => {
  if (x < 0) return 0
  if (x === 0) {
    if (shape === 1) return N.unsafeDivide(1, scale)
    return 0
  }
  return Math.exp(
    N.subtract(
      N.subtract(
        N.multiply(N.subtract(shape, 1), Math.log(x)),
        N.unsafeDivide(x, scale)
      ),
      N.sum(
        N.multiply(shape, Math.log(scale)),
        lnGammaLanczos(shape)
      )
    )
  )
}

/**
 * Gamma log-PDF: (k−1)ln(x) − x/θ − k·ln(θ) − ln Γ(k).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaLogpdf = (x: number, shape: number, scale: number): number => {
  if (x <= 0) return -Infinity
  return N.subtract(
    N.subtract(
      N.multiply(N.subtract(shape, 1), Math.log(x)),
      N.unsafeDivide(x, scale)
    ),
    N.sum(
      N.multiply(shape, Math.log(scale)),
      lnGammaLanczos(shape)
    )
  )
}

/**
 * Gamma CDF via regularized lower incomplete gamma P(k, x/θ).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaCdf = (x: number, shape: number, scale: number): number => {
  if (x <= 0) return 0
  return gammaincKernel(shape, N.unsafeDivide(x, scale))
}

/**
 * Tail-recursive Newton–Raphson loop for the gamma quantile.
 *
 * @since 0.1.0
 * @category internal
 */
const gammaQuantileLoop = (
  p: number,
  shape: number,
  scale: number,
  x: number,
  remaining: number
): number => {
  if (remaining === 0) return x
  const f = N.subtract(gammaCdf(x, shape, scale), p)
  const fprime = gammaPdf(x, shape, scale)
  if (fprime < 1e-30) return x
  if (Math.abs(f) < 1e-12) return x
  const xNext = Math.max(1e-15, N.subtract(x, N.unsafeDivide(f, fprime)))
  return gammaQuantileLoop(p, shape, scale, xNext, N.subtract(remaining, 1))
}

/**
 * Gamma quantile (inverse CDF) via Newton–Raphson iteration.
 *
 * Returns x such that P(k, x/θ) ≈ p. Initial guess uses shape·scale
 * scaled by p for small p.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaQuantile = (p: number, shape: number, scale: number): number => {
  const guess = p < 0.05
    ? Math.max(1e-10, N.multiply(N.multiply(shape, scale), p))
    : N.multiply(shape, scale)
  return gammaQuantileLoop(p, shape, scale, guess, 50)
}

/**
 * Gamma mean: kθ.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaMean = (shape: number, scale: number): number => N.multiply(shape, scale)

/**
 * Gamma variance: kθ².
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaVariance = (shape: number, scale: number): number => N.multiply(shape, N.multiply(scale, scale))

/**
 * Gamma differential entropy:
 * k + ln(θ) + ln Γ(k) + (1−k)ψ(k).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaEntropy = (shape: number, scale: number): number =>
  N.sum(
    N.sum(shape, Math.log(scale)),
    N.sum(
      lnGammaLanczos(shape),
      N.multiply(N.subtract(1, shape), digammaKernel(shape))
    )
  )
