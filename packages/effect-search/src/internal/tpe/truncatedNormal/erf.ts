import type { Chunk } from "effect"
import { Data, Match, Number as Num } from "effect"

import * as Float64 from "../../float64.js"
import {
  EFX,
  ERF_RIGHT_NON_BIG_THRESHOLD,
  ERF_SPLIT_LARGE,
  ERF_SPLIT_MIDDLE,
  ERF_SPLIT_SMALL,
  ERX,
  PA,
  PP,
  QA,
  QQ,
  RA,
  RB,
  SA,
  SB,
  TWO_POW_NEG_28
} from "./constants.js"
import { polynomial } from "./polynomial.js"

class RationalTailCoefficients extends Data.Class<{
  readonly numerator: Chunk.Chunk<number>
  readonly denominator: Chunk.Chunk<number>
}> {}

const tailApproximation = (x: number, coefficients: RationalTailCoefficients): number => {
  const reciprocalSquare = Num.unsafeDivide(1, x * x)
  const correction = Num.unsafeDivide(
    polynomial(coefficients.numerator, reciprocalSquare),
    polynomial(coefficients.denominator, reciprocalSquare)
  )

  return Num.unsafeDivide(Float64.exp(-(x * x) - 0.5625 + correction), x)
}

const positiveTail = (x: number): number =>
  Match.value(x).pipe(
    Match.when((value) => value < ERF_SPLIT_LARGE, (value) =>
      tailApproximation(value, new RationalTailCoefficients({ numerator: RA, denominator: SA }))),
    Match.orElse((value) =>
      tailApproximation(value, new RationalTailCoefficients({ numerator: RB, denominator: SB }))
    )
  )

const nearZeroApproximation = (x: number): number => (1 + EFX) * x

const polynomialApproximation = (x: number): number => {
  const square = x * x
  return x * (1 + Num.unsafeDivide(polynomial(PP, square), polynomial(QQ, square)))
}

const shiftedApproximation = (x: number): number => {
  const shifted = x - 1
  return ERX + Num.unsafeDivide(polynomial(PA, shifted), polynomial(QA, shifted))
}

const erfRightNonBig = (x: number): number => {
  return Match.value(x).pipe(
    Match.when((value) => value < TWO_POW_NEG_28, nearZeroApproximation),
    Match.when((value) => value < ERF_SPLIT_SMALL, polynomialApproximation),
    Match.when((value) => value < ERF_SPLIT_MIDDLE, shiftedApproximation),
    Match.orElse((value) => 1 - positiveTail(value))
  )
}

const erfcPositive = (x: number): number => {
  return Match.value(x).pipe(
    Match.when((value) => value < TWO_POW_NEG_28, (value) => 1 - nearZeroApproximation(value)),
    Match.when((value) => value < ERF_SPLIT_SMALL, (value) => 1 - polynomialApproximation(value)),
    Match.when((value) => value < ERF_SPLIT_MIDDLE, (value) => 1 - shiftedApproximation(value)),
    Match.orElse((value) => positiveTail(value))
  )
}

export const erf = (x: number): number => {
  return Match.value(x).pipe(
    Match.when(Number.isNaN, () => Number.NaN),
    Match.when((value) => value === Number.POSITIVE_INFINITY, () => 1),
    Match.when((value) => value === Number.NEGATIVE_INFINITY, () => -1),
    Match.orElse((value) => {
      const absoluteX = Float64.abs(value)
      const rightValue = absoluteX < ERF_RIGHT_NON_BIG_THRESHOLD ? erfRightNonBig(absoluteX) : 1

      return value < 0 ? -rightValue : rightValue
    })
  )
}

export const erfc = (x: number): number => {
  return Match.value(x).pipe(
    Match.when(Number.isNaN, () => Number.NaN),
    Match.when((value) => value >= 0, erfcPositive),
    Match.orElse((value) => 2 - erfcPositive(-value))
  )
}
