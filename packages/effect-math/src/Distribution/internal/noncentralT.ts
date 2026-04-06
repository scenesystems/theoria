/**
 * Noncentral Student's t-distribution kernels.
 *
 * The CDF follows the Poisson-weighted incomplete-beta expansion documented by
 * SciPy and Boost. Quantiles reuse the released Brent solver so Distribution
 * owns the statistical surface while Optimization owns the inversion kernel.
 *
 * @since 0.3.0
 * @category internal
 */
import { Number as N } from "effect"

import { abs, exp, PI, sqrt } from "../../Numeric/operations.js"
import { brent } from "../../Optimization/operations.js"
import { betainc } from "../../Special/operations.js"
import { normalCdf } from "./normal.js"
import { studentTCdf, studentTQuantile } from "./studentT.js"

const SERIES_TOLERANCE = 1e-14
const MAX_SERIES_TERMS = 512
const MAX_BRACKET_EXPANSIONS = 32
const QUANTILE_ABSOLUTE_TOLERANCE = 1e-10
const QUANTILE_RELATIVE_TOLERANCE = 1e-10
const QUANTILE_MAX_ITERATIONS = 128
const DELTA_ZERO_TOLERANCE = 1e-12
const SQRT_TWO_OVER_PI = sqrt(N.unsafeDivide(2, PI))

const clampUnitInterval = (value: number): number => N.max(0, N.min(1, value))

const betaArgument = (x: number, df: number): number => {
  const xSquared = N.multiply(x, x)

  return N.unsafeDivide(xSquared, N.sum(xSquared, df))
}

const noncentralTPositiveCdf = (x: number, df: number, noncentrality: number): number => {
  if (N.lessThanOrEqualTo(abs(noncentrality), DELTA_ZERO_TOLERANCE)) {
    return studentTCdf(x, df)
  }

  const y = betaArgument(x, df)
  const halfDf = N.unsafeDivide(df, 2)
  const lambdaHalf = N.unsafeDivide(N.multiply(noncentrality, noncentrality), 2)
  const p0 = exp(N.multiply(-1, lambdaHalf))
  const q0 = N.multiply(noncentrality, N.multiply(p0, SQRT_TWO_OVER_PI))

  return clampUnitInterval(
    N.sum(
      normalCdf(N.multiply(-1, noncentrality), 0, 1),
      noncentralTSeries(y, halfDf, lambdaHalf, 0, p0, q0, 0)
    )
  )
}

const noncentralTSeries = (
  y: number,
  halfDf: number,
  lambdaHalf: number,
  index: number,
  pTerm: number,
  qTerm: number,
  accumulated: number
): number => {
  if (
    index >= MAX_SERIES_TERMS ||
    (index > 0 && N.lessThanOrEqualTo(N.sum(abs(pTerm), abs(qTerm)), SERIES_TOLERANCE))
  ) {
    return accumulated
  }

  const nextAccumulated = N.sum(
    accumulated,
    N.multiply(
      0.5,
      N.sum(
        N.multiply(pTerm, betainc(N.sum(index, 0.5), halfDf, y)),
        N.multiply(qTerm, betainc(N.sum(index, 1), halfDf, y))
      )
    )
  )

  return noncentralTSeries(
    y,
    halfDf,
    lambdaHalf,
    index + 1,
    N.multiply(pTerm, N.unsafeDivide(lambdaHalf, N.sum(index, 1))),
    N.multiply(qTerm, N.unsafeDivide(lambdaHalf, N.sum(index, 1.5))),
    nextAccumulated
  )
}

const expandBracket = (
  p: number,
  df: number,
  noncentrality: number,
  lower: number,
  upper: number,
  step: number,
  remaining: number
): readonly [number, number] => {
  const lowerCdf = noncentralTCdf(lower, df, noncentrality)
  const upperCdf = noncentralTCdf(upper, df, noncentrality)

  if (lowerCdf <= p && p <= upperCdf) {
    return [lower, upper]
  }

  if (remaining === 0) {
    return [lower, upper]
  }

  const doubledStep = N.multiply(step, 2)

  return p < lowerCdf
    ? expandBracket(p, df, noncentrality, N.subtract(lower, doubledStep), lower, doubledStep, remaining - 1)
    : expandBracket(p, df, noncentrality, upper, N.sum(upper, doubledStep), doubledStep, remaining - 1)
}

/**
 * Noncentral Student's t CDF.
 *
 * @since 0.3.0
 * @category internal
 */
export const noncentralTCdf = (x: number, df: number, noncentrality: number): number =>
  N.lessThan(x, 0)
    ? clampUnitInterval(N.subtract(1, noncentralTPositiveCdf(N.multiply(-1, x), df, N.multiply(-1, noncentrality))))
    : noncentralTPositiveCdf(x, df, noncentrality)

/**
 * Noncentral Student's t quantile.
 *
 * @since 0.3.0
 * @category internal
 */
export const noncentralTQuantile = (p: number, df: number, noncentrality: number): number => {
  if (N.lessThanOrEqualTo(abs(noncentrality), DELTA_ZERO_TOLERANCE)) {
    return studentTQuantile(p, df)
  }

  const initialGuess = N.sum(noncentrality, studentTQuantile(p, df))
  const [lower, upper] = expandBracket(
    p,
    df,
    noncentrality,
    N.subtract(initialGuess, 1),
    N.sum(initialGuess, 1),
    1,
    MAX_BRACKET_EXPANSIONS
  )

  return brent(
    (value) => N.subtract(noncentralTCdf(value, df, noncentrality), p),
    lower,
    upper,
    {
      absoluteTolerance: QUANTILE_ABSOLUTE_TOLERANCE,
      relativeTolerance: QUANTILE_RELATIVE_TOLERANCE,
      maxIterations: QUANTILE_MAX_ITERATIONS
    }
  ).root
}
