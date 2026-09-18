/**
 * Authorized binary64 engine intrinsics and reproducible precision-policy kernels.
 * Effect Number owns all surrounding arithmetic.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Match, Number, Predicate } from "effect"

import * as Binary from "./binary.js"

const lnTwo = 0.6931471805599453
const zero = (value: number): boolean => Number.Equivalence(value, 0)
const positiveInfinity = (value: number): boolean => Number.Equivalence(value, Binary.positiveInfinity)

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

/** Real-valued power including signed-zero, negative-base, and infinity rules. */
export const pow: (base: number, exponent: number) => number = Math.pow

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
const logarithmStrictSeries = (z: number): number => {
  const square = Number.multiply(z, z)
  const t3 = Number.multiply(z, square)
  const s3 = Number.sum(z, Number.unsafeDivide(t3, 3))
  const t5 = Number.multiply(t3, square)
  const s5 = Number.sum(s3, Number.unsafeDivide(t5, 5))
  const t7 = Number.multiply(t5, square)
  const s7 = Number.sum(s5, Number.unsafeDivide(t7, 7))
  const t9 = Number.multiply(t7, square)
  const s9 = Number.sum(s7, Number.unsafeDivide(t9, 9))
  const t11 = Number.multiply(t9, square)
  const s11 = Number.sum(s9, Number.unsafeDivide(t11, 11))
  const t13 = Number.multiply(t11, square)
  const s13 = Number.sum(s11, Number.unsafeDivide(t13, 13))
  const t15 = Number.multiply(t13, square)
  const s15 = Number.sum(s13, Number.unsafeDivide(t15, 15))
  const t17 = Number.multiply(t15, square)
  const s17 = Number.sum(s15, Number.unsafeDivide(t17, 17))
  const t19 = Number.multiply(t17, square)
  const s19 = Number.sum(s17, Number.unsafeDivide(t19, 19))
  const t21 = Number.multiply(t19, square)
  const s21 = Number.sum(s19, Number.unsafeDivide(t21, 21))
  const t23 = Number.multiply(t21, square)
  const s23 = Number.sum(s21, Number.unsafeDivide(t23, 23))
  const t25 = Number.multiply(t23, square)
  const s25 = Number.sum(s23, Number.unsafeDivide(t25, 25))
  const t27 = Number.multiply(t25, square)
  const s27 = Number.sum(s25, Number.unsafeDivide(t27, 27))
  const t29 = Number.multiply(t27, square)
  const s29 = Number.sum(s27, Number.unsafeDivide(t29, 29))
  const t31 = Number.multiply(t29, square)
  return Number.sum(s29, Number.unsafeDivide(t31, 31))
}

/** Reproduces the established binary64 series and normalization for seeded policies. */
export const logStrict = (value: number): number =>
  Boolean.match(Number.greaterThan(value, 0), {
    onTrue: () =>
      Boolean.match(positiveInfinity(value), {
        onTrue: () => Binary.positiveInfinity,
        onFalse: () => {
          const { mantissa, exponent } = Binary.normalize(value)
          return Boolean.match(Number.Equivalence(mantissa, 1), {
            onTrue: () => Number.multiply(exponent, lnTwo),
            onFalse: () => {
              const z = Number.unsafeDivide(Number.subtract(mantissa, 1), Number.sum(mantissa, 1))
              return Number.sum(Number.multiply(2, logarithmStrictSeries(z)), Number.multiply(exponent, lnTwo))
            }
          })
        }
      }),
    onFalse: () =>
      Boolean.match(zero(value), { onTrue: () => Binary.negativeInfinity, onFalse: () => Binary.notANumber })
  })

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
  const normalized = Binary.normalize(value)
  return Boolean.match(Number.greaterThanOrEqualTo(normalized.mantissa, 1.4142112731933594), {
    onTrue: () =>
      logarithmReduced(
        Number.subtract(Number.multiply(normalized.mantissa, 0.5), 1),
        Number.increment(normalized.exponent),
        correction
      ),
    onFalse: () => logarithmReduced(Number.subtract(normalized.mantissa, 1), normalized.exponent, correction)
  })
}

/** Reproducible precision-policy kernel for ln(1 + x). */
export const log1pStrict = Match.type<number>().pipe(
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(zero, (value) => value),
  Match.when((value) => Number.Equivalence(value, -1), () => Binary.negativeInfinity),
  Match.when(Number.lessThan(-1), () => Binary.notANumber),
  Match.when(positiveInfinity, () => Binary.positiveInfinity),
  Match.when((value) => Number.lessThan(Binary.abs(value), 5.551115123125783e-17), (value) => value),
  Match.when(
    (value) => Number.lessThan(Binary.abs(value), 1.862645149230957e-9),
    (value) => Number.subtract(value, Number.multiply(0.5, Number.multiply(value, value)))
  ),
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

/** Reproducible precision-policy kernel for exp(x) - 1. */
export const expm1Strict = Match.type<number>().pipe(
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(zero, (value) => value),
  Match.when(Number.greaterThan(709.782712893384), () => Binary.positiveInfinity),
  Match.when(Number.lessThan(-38.816242111356935), () => -1),
  Match.when((value) => Number.lessThan(Binary.abs(value), 5.551115123125783e-17), (value) => value),
  Match.orElse(exponentialMinusOneFinite)
)

/** Engine precision-policy kernel for exp(x) - 1. */
export const expm1Relaxed: (value: number) => number = expm1
