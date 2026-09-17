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
import { Boolean, Iterable, Number, Option, Schema, Tuple } from "effect"

import { abs, exp, log, pi, sqrt } from "../../Numeric.js"
import { betainc, erfinv, lnGamma } from "../../Special.js"

const sqrtTwo = sqrt(2)

class StudentTQuantileState
  extends Schema.Class<StudentTQuantileState>("@scenesystems/effect-math/internal/distribution/studentT/QuantileState")(
    {
      x: Schema.Number,
      remaining: Schema.Number
    }
  )
{}

/**
 * Student's t PDF:
 * exp(lnΓ((ν+1)/2) − lnΓ(ν/2) − 0.5·ln(νπ) − ((ν+1)/2)·ln(1+x²/ν))
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTPdf = (x: number, df: number): number => {
  const halfDfP1 = Number.unsafeDivide(Number.sum(df, 1), 2)
  const halfDf = Number.unsafeDivide(df, 2)
  return exp(
    Number.subtract(
      Number.subtract(
        lnGamma(halfDfP1),
        lnGamma(halfDf)
      ),
      Number.sum(
        Number.multiply(0.5, log(Number.multiply(df, pi))),
        Number.multiply(halfDfP1, log(Number.sum(1, Number.unsafeDivide(Number.multiply(x, x), df))))
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
  const halfDfP1 = Number.unsafeDivide(Number.sum(df, 1), 2)
  const halfDf = Number.unsafeDivide(df, 2)
  return Number.subtract(
    Number.subtract(
      lnGamma(halfDfP1),
      lnGamma(halfDf)
    ),
    Number.sum(
      Number.multiply(0.5, log(Number.multiply(df, pi))),
      Number.multiply(halfDfP1, log(Number.sum(1, Number.unsafeDivide(Number.multiply(x, x), df))))
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
  const t2 = Number.multiply(x, x)
  const bx = Number.unsafeDivide(df, Number.sum(df, t2))
  const incompleteBeta = betainc(Number.unsafeDivide(df, 2), 0.5, bx)
  return Boolean.match(Number.greaterThanOrEqualTo(x, 0), {
    onTrue: () => Number.subtract(1, Number.multiply(0.5, incompleteBeta)),
    onFalse: () => Number.multiply(0.5, incompleteBeta)
  })
}

/**
 * Schema-state Newton–Raphson iteration for the Student's t quantile.
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
  const initial = new StudentTQuantileState({ x, remaining })
  return Iterable.reduce(
    Iterable.unfold(initial, (state) => {
      const difference = Number.subtract(studentTCdf(state.x, df), p)
      const density = studentTPdf(state.x, df)
      return Boolean.match(
        Boolean.or(
          Number.Equivalence(state.remaining, 0),
          Boolean.or(Number.lessThan(density, 1e-30), Number.lessThan(abs(difference), 1e-12))
        ),
        {
          onTrue: Option.none,
          onFalse: () => {
            const next = new StudentTQuantileState({
              x: Number.subtract(state.x, Number.unsafeDivide(difference, density)),
              remaining: Number.subtract(state.remaining, 1)
            })
            return Option.some(Tuple.make(next.x, next))
          }
        }
      )
    }),
    x,
    (_x, next) => next
  )
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
  const guess = Number.multiply(
    sqrtTwo,
    erfinv(Number.subtract(Number.multiply(2, p), 1))
  )
  return studentTQuantileLoop(p, df, guess, 50)
}

/**
 * Student's t mean: 0 for ν > 1, NaN otherwise.
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTMean = (df: number): number =>
  Boolean.match(Number.greaterThan(df, 1), { onTrue: () => 0, onFalse: () => NaN })

/**
 * Student's t variance: ν/(ν−2) for ν > 2, Infinity for 1 < ν ≤ 2,
 * NaN otherwise.
 *
 * @since 0.1.0
 * @category internal
 */
export const studentTVariance = (df: number): number => {
  return Boolean.match(Number.greaterThan(df, 2), {
    onTrue: () => Number.unsafeDivide(df, Number.subtract(df, 2)),
    onFalse: () =>
      Boolean.match(Number.greaterThan(df, 1), {
        onTrue: () => Infinity,
        onFalse: () => NaN
      })
  })
}
