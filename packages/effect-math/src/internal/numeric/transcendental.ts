/**
 * Authorized binary64 engine intrinsics and reproducible precision-policy kernels.
 * Strict logarithms retain their established binary64 accumulation order.
 *
 * @since 0.1.0
 * @category internal
 */
import { SemigroupMultiply, SemigroupSum } from "@effect/typeclass/data/Number"
import { Boolean, Match, Number, Predicate } from "effect"
import { Equivalence } from "effect/Number"

import * as Binary from "./binary.js"

const multiply = SemigroupMultiply.combine
const sum = SemigroupSum.combine
const lnTwo = 0.6931471805599453
const zero = (value: number): boolean => Equivalence(value, 0)
const positiveInfinity = (value: number): boolean => Equivalence(value, Binary.positiveInfinity)

/** Natural logarithm; logStrict retains reproducible evaluation. */
export const log: (value: number) => number = Math.log

/** Cancellation-aware natural logarithm of one plus the input. */
export const log1p: (value: number) => number = Math.log1p

/** Exponential with the engine's full overflow and underflow handling. */
export const exp: (value: number) => number = Math.exp

/** Cancellation-aware exponential minus one. */
export const expm1: (value: number) => number = Math.expm1

/** Base-ten logarithm without a second rounding from dividing natural logs. */
export const log10: (value: number) => number = Math.log10

/** Sine with full-range argument reduction. */
export const sin: (value: number) => number = Math.sin

/** Cosine with full-range argument reduction. */
export const cos: (value: number) => number = Math.cos

/** Two-argument arctangent preserving quadrants and signed zero. */
export const atan2: (y: number, x: number) => number = Math.atan2

/** Hyperbolic sine without cancellation or premature overflow. */
export const sinh: (value: number) => number = Math.sinh

/** Hyperbolic cosine without premature intermediate overflow. */
export const cosh: (value: number) => number = Math.cosh

// Preserve the historical left-to-right accumulation, rather than Horner's
// different rounding. On 0 <= z <= 1/3, term 17 / sum <= (1/3)^32 / 33
// < 2^-54, below half a spacing even at a binade boundary. That term and
// all seven later terms of the original 24-term series round away.
// The early exits are exact too: positive terms decrease, so once an
// addition leaves the sum unchanged, every subsequent addition does too.
const logarithmStrictSeries = (z: number): number => {
  const square = multiply(z, z)
  const t3 = multiply(z, square)
  const s3 = sum(z, t3 / 3)
  const t5 = multiply(t3, square)
  const s5 = sum(s3, t5 / 5)
  const t7 = multiply(t5, square)
  const s7 = sum(s5, t7 / 7)
  const t9 = multiply(t7, square)
  const s9 = sum(s7, t9 / 9)
  if (Equivalence(s9, s7)) return s9
  const t11 = multiply(t9, square)
  const s11 = sum(s9, t11 / 11)
  const t13 = multiply(t11, square)
  const s13 = sum(s11, t13 / 13)
  const t15 = multiply(t13, square)
  const s15 = sum(s13, t15 / 15)
  const t17 = multiply(t15, square)
  const s17 = sum(s15, t17 / 17)
  if (Equivalence(s17, s15)) return s17
  const t19 = multiply(t17, square)
  const s19 = sum(s17, t19 / 19)
  const t21 = multiply(t19, square)
  const s21 = sum(s19, t21 / 21)
  const t23 = multiply(t21, square)
  const s23 = sum(s21, t23 / 23)
  const t25 = multiply(t23, square)
  const s25 = sum(s23, t25 / 25)
  if (Equivalence(s25, s23)) return s25
  const t27 = multiply(t25, square)
  const s27 = sum(s25, t27 / 27)
  const t29 = multiply(t27, square)
  const s29 = sum(s27, t29 / 29)
  const t31 = multiply(t29, square)
  return sum(s29, t31 / 31)
}

const logarithmStrictFinite = Binary.withNormalized((mantissa, exponent) => {
  if (Equivalence(mantissa, 1)) return multiply(exponent, lnTwo)
  const z = sum(mantissa, -1) / sum(mantissa, 1)
  return sum(multiply(2, logarithmStrictSeries(z)), multiply(exponent, lnTwo))
})

/** Reproduces the established binary64 series and normalization for seeded policies. */
export const logStrict = (value: number): number => {
  if (!(value > 0)) return log(value)
  if (positiveInfinity(value)) return Binary.positiveInfinity
  return logarithmStrictFinite(value)
}

// Adapted from OpenLibm's fdlibm s_log1p.c and s_expm1.c.
// https://github.com/JuliaMath/openlibm/tree/master/src
// Copyright (C) 1993, 2004 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
const lnTwoHigh = 6.93147180369123816490e-1
const lnTwoLow = 1.90821492927058770002e-10

const logarithmCorrection = (f: number, halfSquare: number): number => {
  const s = Number.unsafeDivide(f, Number.sum(2, f))
  const z = Number.multiply(s, s)
  const w = Number.multiply(z, z)
  const even = Number.sum(2.222219843214978396e-1, Number.multiply(w, 1.531383769920937332e-1))
  const oddHigh = Number.sum(1.818357216161805012e-1, Number.multiply(w, 1.479819860511658591e-1))
  const odd = Number.sum(2.857142874366239149e-1, Number.multiply(w, oddHigh))
  const remainder = Number.sum(
    Number.multiply(w, Number.sum(3.999999999940941908e-1, Number.multiply(w, even))),
    Number.multiply(z, Number.sum(6.666666666666735130e-1, Number.multiply(w, odd)))
  )
  return Number.multiply(s, Number.sum(halfSquare, remainder))
}

const logarithmReduced = (f: number, exponent: number, correction: number): number => {
  const halfSquare = Number.multiply(0.5, Number.multiply(f, f))
  return Number.subtract(
    Number.multiply(exponent, lnTwoHigh),
    Number.subtract(
      Number.subtract(
        halfSquare,
        Number.sum(logarithmCorrection(f, halfSquare), Number.sum(Number.multiply(exponent, lnTwoLow), correction))
      ),
      f
    )
  )
}

const logarithmReducedValue = (value: number, correction: number): number => {
  const [mantissa, exponent] = Binary.normalize(value)
  return Boolean.match(Number.greaterThanOrEqualTo(mantissa, 1.4142112731933594), {
    onTrue: () =>
      logarithmReduced(
        Number.subtract(Number.multiply(mantissa, 0.5), 1),
        Number.increment(exponent),
        correction
      ),
    onFalse: () => logarithmReduced(Number.subtract(mantissa, 1), exponent, correction)
  })
}

const logarithmIncrementSmall = (value: number): number => {
  // For |x| < 2^-12 the degree-five remainder is below 2^-62 relative
  // to x. Subtract the grouped correction to preserve negative zero.
  const square = Number.multiply(value, value)
  const fourthAndFifth = Number.multiply(
    square,
    Number.subtract(0.25, Number.multiply(value, 0.2))
  )
  return Number.subtract(
    value,
    Number.multiply(
      square,
      Number.sum(Number.subtract(0.5, Number.unsafeDivide(value, 3)), fourthAndFifth)
    )
  )
}

/** Reproducible precision-policy kernel for ln(1 + x). */
export const log1pStrict = Match.type<number>().pipe(
  Match.when((value) => Number.lessThan(Binary.abs(value), 0.000244140625), logarithmIncrementSmall),
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when((value) => Number.Equivalence(value, -1), () => Binary.negativeInfinity),
  Match.when(Number.lessThan(-1), () => Binary.notANumber),
  Match.when(positiveInfinity, () => Binary.positiveInfinity),
  Match.when(
    Number.between({ minimum: -0.2928934097290039, maximum: 0.4142136573791504 }),
    (value) => logarithmReduced(value, 0, 0)
  ),
  Match.orElse((value) => {
    const sum = Number.sum(1, value)
    const error = Boolean.match(Number.greaterThan(value, 1), {
      onTrue: () => Number.subtract(1, Number.subtract(sum, value)),
      onFalse: () => Number.subtract(value, Number.subtract(sum, 1))
    })
    return logarithmReducedValue(sum, Number.unsafeDivide(error, sum))
  })
)

/** Engine precision-policy kernel for ln(1 + x). */
export const log1pRelaxed: (value: number) => number = log1p

const exponentialMinusOneFinite = (value: number): number => {
  const exponent = Number.round(Number.multiply(value, 1.44269504088896338700), 0)
  const high = Number.subtract(value, Number.multiply(exponent, lnTwoHigh))
  const low = Number.multiply(exponent, lnTwoLow)
  const reduced = Number.subtract(high, low)
  const correction = Number.subtract(Number.subtract(high, reduced), low)
  const half = Number.multiply(0.5, reduced)
  const halfSquare = Number.multiply(reduced, half)
  const q4 = Number.sum(4.00821782732936239552e-6, Number.multiply(halfSquare, -2.01099218183624371326e-7))
  const q3 = Number.sum(-7.93650757867487942473e-5, Number.multiply(halfSquare, q4))
  const q2 = Number.sum(1.58730158725481460165e-3, Number.multiply(halfSquare, q3))
  const q1 = Number.sum(-3.33333333333331316428e-2, Number.multiply(halfSquare, q2))
  const rational = Number.sum(1, Number.multiply(halfSquare, q1))
  const t = Number.subtract(3, Number.multiply(rational, half))
  const error = Number.multiply(
    halfSquare,
    Number.unsafeDivide(Number.subtract(rational, t), Number.subtract(6, Number.multiply(reduced, t)))
  )
  return Boolean.match(zero(exponent), {
    onTrue: () => Number.subtract(reduced, Number.subtract(Number.multiply(reduced, error), halfSquare)),
    onFalse: () => {
      const adjusted = Number.subtract(
        Number.subtract(Number.multiply(reduced, Number.subtract(error, correction)), correction),
        halfSquare
      )
      return Match.value(exponent).pipe(
        Match.when(-1, () => Number.subtract(Number.multiply(0.5, Number.subtract(reduced, adjusted)), 0.5)),
        Match.when(1, () =>
          Boolean.match(Number.lessThan(reduced, -0.25), {
            onTrue: () => Number.multiply(-2, Number.subtract(adjusted, Number.sum(reduced, 0.5))),
            onFalse: () => Number.sum(1, Number.multiply(2, Number.subtract(reduced, adjusted)))
          })),
        Match.when(
          Predicate.or(Number.lessThan(-1), Number.greaterThan(56)),
          () => Number.subtract(Binary.scalePow2(Number.subtract(1, Number.subtract(adjusted, reduced)), exponent), 1)
        ),
        Match.when(Number.lessThan(20), () =>
          Binary.scalePow2(
            Number.subtract(
              Number.subtract(1, Binary.scalePow2(1, Number.negate(exponent))),
              Number.subtract(adjusted, reduced)
            ),
            exponent
          )),
        Match.orElse(() =>
          Binary.scalePow2(
            Number.sum(1, Number.subtract(reduced, Number.sum(adjusted, Binary.scalePow2(1, Number.negate(exponent))))),
            exponent
          )
        )
      )
    }
  })
}

const exponentialMinusOneSmall = (value: number): number => {
  // For |x| < 2^-12 the degree-five remainder is below 2^-69 relative
  // to x. Keep the fdlibm correction grouping, including signed zero.
  const halfSquare = Number.multiply(0.5, Number.multiply(value, value))
  const error = Number.multiply(
    Number.unsafeDivide(Number.negate(halfSquare), 3),
    Number.sum(1, Number.multiply(value, Number.sum(0.25, Number.multiply(value, 0.05))))
  )
  return Number.subtract(value, Number.subtract(Number.multiply(value, error), halfSquare))
}

/** Reproducible precision-policy kernel for exp(x) - 1. */
export const expm1Strict = Match.type<number>().pipe(
  Match.when((value) => Number.lessThan(Binary.abs(value), 0.000244140625), exponentialMinusOneSmall),
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(Number.greaterThan(709.782712893384), () => Binary.positiveInfinity),
  Match.when(Number.lessThan(-38.816242111356935), () => -1),
  Match.orElse(exponentialMinusOneFinite)
)

/** Engine precision-policy kernel for exp(x) - 1. */
export const expm1Relaxed: (value: number) => number = expm1
