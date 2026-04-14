/**
 * Student's t-distribution kernels.
 * Parameter: df (degrees of freedom, ν > 0).
 *
 * CDF uses the relationship with the regularized incomplete beta function:
 *   For x ≥ 0: CDF = 1 − 0.5 · I_{df/(df+x²)}(df/2, 1/2)
 *   For x < 0:  CDF = 0.5 · I_{df/(df+x²)}(df/2, 1/2)
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { betainc, erfinv, lnGamma } from "../../Special/operations.js"

/**
 * Student's t PDF:
 * exp(lnΓ((ν+1)/2) − lnΓ(ν/2) − 0.5·ln(νπ) − ((ν+1)/2)·ln(1+x²/ν))
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTPdf = (x: number, df: number): number => {
  const halfDfP1 = N.unsafeDivide(N.sum(df, 1), 2)
  const halfDf = N.unsafeDivide(df, 2)
  return Math.exp(
    N.subtract(
      N.subtract(
        lnGamma(halfDfP1),
        lnGamma(halfDf)
      ),
      N.sum(
        N.multiply(0.5, Math.log(N.multiply(df, Math.PI))),
        N.multiply(halfDfP1, Math.log(N.sum(1, N.unsafeDivide(N.multiply(x, x), df))))
      )
    )
  )
}

/**
 * Student's t log-PDF:
 * lnΓ((ν+1)/2) − lnΓ(ν/2) − 0.5·ln(νπ) − ((ν+1)/2)·ln(1+x²/ν)
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTLogpdf = (x: number, df: number): number => {
  const halfDfP1 = N.unsafeDivide(N.sum(df, 1), 2)
  const halfDf = N.unsafeDivide(df, 2)
  return N.subtract(
    N.subtract(
      lnGamma(halfDfP1),
      lnGamma(halfDf)
    ),
    N.sum(
      N.multiply(0.5, Math.log(N.multiply(df, Math.PI))),
      N.multiply(halfDfP1, Math.log(N.sum(1, N.unsafeDivide(N.multiply(x, x), df))))
    )
  )
}

/**
 * Student's t CDF via regularized incomplete beta.
 *
 * For x ≥ 0: 1 − 0.5 · I_{ν/(ν+x²)}(ν/2, 1/2)
 * For x < 0: 0.5 · I_{ν/(ν+x²)}(ν/2, 1/2)
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTCdf = (x: number, df: number): number => {
  const t2 = N.multiply(x, x)
  const bx = N.unsafeDivide(df, N.sum(df, t2))
  const ib = betainc(N.unsafeDivide(df, 2), 0.5, bx)
  return x >= 0
    ? N.subtract(1, N.multiply(0.5, ib))
    : N.multiply(0.5, ib)
}

/**
 * Tail-recursive Newton–Raphson loop for the Student's t quantile.
 *
 * @since 0.1.0
 * @category internal
 */
const studentTQuantileLoop = (
  p: number,
  df: number,
  x: number,
  remaining: number
): number => {
  if (remaining === 0) return x
  const f = N.subtract(studentTCdf(x, df), p)
  const fprime = studentTPdf(x, df)
  if (fprime < 1e-30) return x
  if (Math.abs(f) < 1e-12) return x
  const xNext = N.subtract(x, N.unsafeDivide(f, fprime))
  return studentTQuantileLoop(p, df, xNext, N.subtract(remaining, 1))
}

/**
 * Student's t quantile (inverse CDF) via Newton–Raphson iteration.
 *
 * Initial guess uses the standard normal quantile √2 · erfinv(2p − 1).
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTQuantile = (p: number, df: number): number => {
  const guess = N.multiply(
    Math.SQRT2,
    erfinv(N.subtract(N.multiply(2, p), 1))
  )
  return studentTQuantileLoop(p, df, guess, 50)
}

/**
 * Student's t mean: 0 for ν > 1, NaN otherwise.
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTMean = (df: number): number => df > 1 ? 0 : NaN

/**
 * Student's t variance: ν/(ν−2) for ν > 2, Infinity for 1 < ν ≤ 2,
 * NaN otherwise.
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTVariance = (df: number): number => {
  if (df > 2) return N.unsafeDivide(df, N.subtract(df, 2))
  if (df > 1) return Infinity
  return NaN
}
