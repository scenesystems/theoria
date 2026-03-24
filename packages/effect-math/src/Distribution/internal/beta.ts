/**
 * Beta distribution kernels.
 * Parameters: alpha > 0, beta > 0. Support: x ∈ [0, 1].
 *
 * CDF delegates to betainc from Special/internal/betainc.js.
 * Log-normalisation uses lnGamma from Special/internal/gamma.js.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { betaincKernel } from "../../Special/internal/betainc.js"
import { digammaKernel } from "../../Special/internal/digamma.js"
import { lnGammaLanczos } from "../../Special/internal/gamma.js"

/**
 * Log of the Beta function B(a,b) = Γ(a)Γ(b)/Γ(a+b).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaLogNorm = (a: number, b: number): number =>
  N.subtract(
    N.sum(lnGammaLanczos(a), lnGammaLanczos(b)),
    lnGammaLanczos(N.sum(a, b))
  )

/**
 * Beta PDF: x^{α−1}(1−x)^{β−1} / B(α,β) for x ∈ (0,1).
 *
 * Handles boundary cases: x = 0 when α = 1, x = 1 when β = 1.
 *
 * @since 0.1.0
 * @category internal
 */
export const betaPdf = (x: number, alpha: number, beta: number): number => {
  if (x <= 0 || x >= 1) {
    if (x === 0 && alpha === 1) return Math.exp(N.negate(betaLogNorm(alpha, beta)))
    if (x === 1 && beta === 1) return Math.exp(N.negate(betaLogNorm(alpha, beta)))
    return 0
  }
  return Math.exp(
    N.subtract(
      N.sum(
        N.multiply(N.subtract(alpha, 1), Math.log(x)),
        N.multiply(N.subtract(beta, 1), Math.log(N.subtract(1, x)))
      ),
      betaLogNorm(alpha, beta)
    )
  )
}

/**
 * Beta log-PDF: (α−1)ln(x) + (β−1)ln(1−x) − ln B(α,β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaLogpdf = (x: number, alpha: number, beta: number): number => {
  if (x <= 0 || x >= 1) return -Infinity
  return N.subtract(
    N.sum(
      N.multiply(N.subtract(alpha, 1), Math.log(x)),
      N.multiply(N.subtract(beta, 1), Math.log(N.subtract(1, x)))
    ),
    betaLogNorm(alpha, beta)
  )
}

/**
 * Beta CDF via regularized incomplete beta I_x(α,β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaCdf = (x: number, alpha: number, beta: number): number => {
  if (x <= 0) return 0
  if (x >= 1) return 1
  return betaincKernel(alpha, beta, x)
}

/**
 * Tail-recursive Newton–Raphson loop for the beta quantile.
 *
 * @since 0.1.0
 * @category internal
 */
const betaQuantileLoop = (
  p: number,
  alpha: number,
  beta: number,
  x: number,
  remaining: number
): number => {
  if (remaining === 0) return x
  const f = N.subtract(betaCdf(x, alpha, beta), p)
  const fprime = betaPdf(x, alpha, beta)
  if (fprime < 1e-30) return x
  if (Math.abs(f) < 1e-12) return x
  const xNext = Math.max(
    1e-15,
    Math.min(N.subtract(1, 1e-15), N.subtract(x, N.unsafeDivide(f, fprime)))
  )
  return betaQuantileLoop(p, alpha, beta, xNext, N.subtract(remaining, 1))
}

/**
 * Beta quantile (inverse CDF) via Newton–Raphson iteration.
 *
 * Returns x such that I_x(α,β) ≈ p. Clamped to [1e-15, 1−1e-15].
 *
 * @since 0.1.0
 * @category internal
 */
export const betaQuantile = (p: number, alpha: number, beta: number): number =>
  betaQuantileLoop(p, alpha, beta, 0.5, 20)

/**
 * Beta mean: α / (α + β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaMean = (alpha: number, beta: number): number => N.unsafeDivide(alpha, N.sum(alpha, beta))

/**
 * Beta variance: αβ / ((α+β)²(α+β+1)).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaVariance = (alpha: number, beta: number): number => {
  const ab = N.sum(alpha, beta)
  return N.unsafeDivide(
    N.multiply(alpha, beta),
    N.multiply(N.multiply(ab, ab), N.sum(ab, 1))
  )
}

/**
 * Beta differential entropy:
 * ln B(α,β) − (α−1)ψ(α) − (β−1)ψ(β) + (α+β−2)ψ(α+β).
 *
 * @since 0.1.0
 * @category internal
 */
export const betaEntropy = (alpha: number, beta: number): number =>
  N.sum(
    N.subtract(
      betaLogNorm(alpha, beta),
      N.sum(
        N.multiply(N.subtract(alpha, 1), digammaKernel(alpha)),
        N.multiply(N.subtract(beta, 1), digammaKernel(beta))
      )
    ),
    N.multiply(N.subtract(N.sum(alpha, beta), 2), digammaKernel(N.sum(alpha, beta)))
  )
