/**
 * Transcendental kernels using Effect's public arithmetic and matching APIs,
 * with authorized engine intrinsics for ordinary log, sin, and cos.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Match, Number, Predicate, Tuple } from "effect"

import * as Binary from "./binary.js"

const lnTwo = 0.6931471805599453
const halfPi = 1.5707963267948966
const quarterPi = 0.7853981633974483
const threeQuarterPi = 2.356194490192345
const pi = 3.141592653589793
const maxSafeInteger = 9_007_199_254_740_991

// Adapted from OpenLibm's fdlibm e_log.c, e_log10.c, e_exp.c, s_log1p.c,
// s_expm1.c and s_atan.c.
// https://github.com/JuliaMath/openlibm/tree/master/src
// Copyright (C) 1993, 2004 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
const lnTwoHigh = 6.93147180369123816490e-1
const lnTwoLow = 1.90821492927058770002e-10

const integer = Predicate.and(
  Binary.isFinite,
  (value: number) => Number.Equivalence(Number.round(value, 0), value)
)
const zero = (value: number): boolean => Number.Equivalence(value, 0)
const positiveInfinity = (value: number): boolean => Number.Equivalence(value, Binary.positiveInfinity)
const negativeInfinity = (value: number): boolean => Number.Equivalence(value, Binary.negativeInfinity)
const negativeZero = Predicate.and(zero, (value: number) => negativeInfinity(Number.unsafeDivide(1, value)))
const negativeSign = Predicate.or(Number.lessThan(0), negativeZero)
const withSign = (magnitude: number, sign: number): number =>
  Boolean.match(negativeSign(sign), { onTrue: () => Number.negate(magnitude), onFalse: () => magnitude })

// Fixed-degree fdlibm polynomials. Scalar evaluation avoids allocating a
// collection/iterator at every operation in the search objective.
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

const logarithmNormalize = (value: number): Binary.Normalized => {
  const normalized = Binary.normalize(value)
  return Boolean.match(Number.greaterThanOrEqualTo(normalized.mantissa, 1.4142112731933594), {
    onTrue: () =>
      new Binary.Normalized({
        mantissa: Number.multiply(normalized.mantissa, 0.5),
        exponent: Number.increment(normalized.exponent)
      }),
    onFalse: () => normalized
  })
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

/**
 * Natural logarithm with IEEE exceptional-value behavior.
 * Authorized engine intrinsic; logStrict retains reproducible evaluation.
 */
export const log: (value: number) => number = Math.log

// Preserve the original left-to-right additions: Horner would change seeded
// optimizer decisions. Bounded scalar recursion removes per-term tuples.
const logarithmStrictSeries = (square: number, term: number, denominator: number, total: number): number =>
  Boolean.match(Number.greaterThan(denominator, 47), {
    onTrue: () => total,
    onFalse: () => {
      const next = Number.sum(total, Number.unsafeDivide(term, denominator))
      // All remaining terms are nonnegative and decreasing on [1, 2).
      // Once one rounds away, every later addition leaves the same total.
      return Boolean.match(Number.Equivalence(next, total), {
        onTrue: () => total,
        onFalse: () =>
          logarithmStrictSeries(
            square,
            Number.multiply(term, square),
            Number.sum(denominator, 2),
            next
          )
      })
    }
  })

/**
 * Reproducible binary64 logarithm for deterministic numerical policies.
 * Keeps the established 24-term accumulation order and [1, 2) reduction so
 * seeded consumers retain their decisions, without storage inspection.
 */
export const logStrict = Match.type<number>().pipe(
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(positiveInfinity, () => Binary.positiveInfinity),
  Match.when(zero, () => Binary.negativeInfinity),
  Match.when(Number.lessThan(0), () => Binary.notANumber),
  Match.orElse((value) => {
    const { mantissa, exponent } = Binary.normalize(value)
    const z = Number.unsafeDivide(Number.subtract(mantissa, 1), Number.sum(mantissa, 1))
    const square = Number.multiply(z, z)
    const total = logarithmStrictSeries(square, z, 1, 0)
    return Number.sum(Number.multiply(2, total), Number.multiply(exponent, lnTwo))
  })
)

/** Cancellation-aware `ln(1 + x)`. */
export const log1p = Match.type<number>().pipe(
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

/** Strict precision-policy kernel for `ln(1 + x)`. */
export const log1pStrict: (value: number) => number = log1p

/** Relaxed precision-policy kernel; native composition is shared by both modes. */
export const log1pRelaxed: (value: number) => number = log1p

const exponentialFinite = (value: number, scaleAdjustment: number): number => {
  const exponent = Number.round(Number.multiply(value, 1.44269504088896338700), 0)
  const high = Number.subtract(value, Number.multiply(exponent, lnTwoHigh))
  const low = Number.multiply(exponent, lnTwoLow)
  const reduced = Number.subtract(high, low)
  const square = Number.multiply(reduced, reduced)
  const p4 = Number.sum(-1.65339022054652515390e-6, Number.multiply(square, 4.13813679705723846039e-8))
  const p3 = Number.sum(6.61375632143793436117e-5, Number.multiply(square, p4))
  const p2 = Number.sum(-2.77777777770155933842e-3, Number.multiply(square, p3))
  const p1 = Number.sum(1.66666666666666019037e-1, Number.multiply(square, p2))
  const correction = Number.subtract(reduced, Number.multiply(square, p1))
  const result = Number.subtract(
    1,
    Number.subtract(
      Number.subtract(
        low,
        Number.unsafeDivide(Number.multiply(reduced, correction), Number.subtract(2, correction))
      ),
      high
    )
  )
  return Binary.scalePow2(result, Number.sum(exponent, scaleAdjustment))
}

/** Exponential with range reduction by ln(2) and exact dyadic rescaling. */
export const exp = Match.type<number>().pipe(
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(positiveInfinity, () => Binary.positiveInfinity),
  Match.when(negativeInfinity, () => 0),
  Match.when(Number.greaterThan(709.782712893384), () => Binary.positiveInfinity),
  Match.when(Number.lessThan(-745.1332191019411), () => 0),
  // fdlibm's unity correction rounds Euler's number down rather than up.
  Match.when((value) => Number.Equivalence(value, 1), () => 2.718281828459045),
  Match.when((value) => Number.lessThan(Binary.abs(value), 3.725290298461914e-9), (value) => Number.sum(1, value)),
  Match.orElse((value) => exponentialFinite(value, 0))
)

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

/** Cancellation-aware `exp(x) - 1`. */
export const expm1 = Match.type<number>().pipe(
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(zero, (value) => value),
  Match.when(Number.greaterThan(709.782712893384), () => Binary.positiveInfinity),
  Match.when(Number.lessThan(-38.816242111356935), () => -1),
  Match.when((value) => Number.lessThan(Binary.abs(value), 5.551115123125783e-17), (value) => value),
  Match.orElse(exponentialMinusOneFinite)
)

/** Strict precision-policy kernel for `exp(x) - 1`. */
export const expm1Strict: (value: number) => number = expm1

/** Relaxed precision-policy kernel; native composition is shared by both modes. */
export const expm1Relaxed: (value: number) => number = expm1

/** Base-10 logarithm with a compensated split-constant reconstruction. */
export const log10 = Match.type<number>().pipe(
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(positiveInfinity, () => Binary.positiveInfinity),
  Match.when(zero, () => Binary.negativeInfinity),
  Match.when(Number.lessThan(0), () => Binary.notANumber),
  Match.orElse((value) => {
    const { mantissa, exponent } = logarithmNormalize(value)
    const f = Number.subtract(mantissa, 1)
    const halfSquare = Number.multiply(0.5, Number.multiply(f, f))
    const leading = Number.subtract(f, halfSquare)
    const split = Number.multiply(134217729, leading)
    const high = Number.subtract(split, Number.subtract(split, leading))
    const low = Number.sum(Number.subtract(Number.subtract(f, high), halfSquare), logarithmCorrection(f, halfSquare))
    const valueHigh = Number.multiply(high, 4.34294481878168880939e-1)
    const exponentHigh = Number.multiply(exponent, 3.01029995663611771306e-1)
    const valueLow = Number.sum(
      Number.sum(
        Number.multiply(exponent, 3.69423907715893078616e-13),
        Number.multiply(Number.sum(low, high), 2.50829467116452752298e-11)
      ),
      Number.multiply(low, 4.34294481878168880939e-1)
    )
    const total = Number.sum(exponentHigh, valueHigh)
    return Number.sum(Number.sum(Number.sum(valueLow, Number.subtract(exponentHigh, total)), valueHigh), total)
  })
)

const oddInteger = (value: number): boolean =>
  Boolean.match(Boolean.and(integer(value), Number.lessThanOrEqualTo(Binary.abs(value), maxSafeInteger)), {
    onFalse: () => false,
    onTrue: () => Boolean.not(Number.Equivalence(Number.multiply(Binary.floor(Number.multiply(value, 0.5)), 2), value))
  })

const positiveIntegerPower = (base: number, exponent: number, accumulator: number): number =>
  Boolean.match(zero(exponent), {
    onTrue: () => accumulator,
    onFalse: () => {
      const half = Binary.floor(Number.multiply(exponent, 0.5))
      const odd = Number.greaterThan(exponent, Number.multiply(half, 2))
      return positiveIntegerPower(
        Number.multiply(base, base),
        half,
        Boolean.match(odd, {
          onTrue: () => Number.multiply(accumulator, base),
          onFalse: () => accumulator
        })
      )
    }
  })

const integerPower = (base: number, exponent: number): number =>
  Boolean.match(Number.lessThan(exponent, 0), {
    onTrue: () => positiveIntegerPower(Number.unsafeDivide(1, base), Number.negate(exponent), 1),
    onFalse: () => positiveIntegerPower(base, exponent, 1)
  })

const zeroPower = (base: number, exponent: number): number => {
  const signed = Boolean.and(negativeZero(base), oddInteger(exponent))
  return Boolean.match(Number.greaterThan(exponent, 0), {
    onTrue: () => Boolean.match(signed, { onTrue: () => -0, onFalse: () => 0 }),
    onFalse: () =>
      Boolean.match(signed, { onTrue: () => Binary.negativeInfinity, onFalse: () => Binary.positiveInfinity })
  })
}

const infinitePower = (base: number, exponent: number): number => {
  const signed = Boolean.and(negativeSign(base), oddInteger(exponent))
  return Boolean.match(Number.greaterThan(exponent, 0), {
    onTrue: () =>
      Boolean.match(signed, { onTrue: () => Binary.negativeInfinity, onFalse: () => Binary.positiveInfinity }),
    onFalse: () => Boolean.match(signed, { onTrue: () => -0, onFalse: () => 0 })
  })
}

const power = Match.type<readonly [number, number]>().pipe(
  Match.when(([, exponent]) => zero(exponent), () => 1),
  Match.when(([base, exponent]) => Boolean.or(Binary.isNaN(base), Binary.isNaN(exponent)), () => Binary.notANumber),
  Match.when(
    ([base, exponent]) => Boolean.and(zero(base), Predicate.not(zero)(exponent)),
    ([base, exponent]) => zeroPower(base, exponent)
  ),
  Match.when(
    ([base, exponent]) =>
      Boolean.and(Predicate.or(positiveInfinity, negativeInfinity)(base), Predicate.not(zero)(exponent)),
    ([base, exponent]) => infinitePower(base, exponent)
  ),
  Match.when(([, exponent]) => positiveInfinity(exponent), ([base]) =>
    Match.value(Binary.abs(base)).pipe(
      Match.when(Number.greaterThan(1), () => Binary.positiveInfinity),
      Match.when(Number.lessThan(1), () => 0),
      Match.orElse(() => Binary.notANumber)
    )),
  Match.when(([, exponent]) => negativeInfinity(exponent), ([base]) =>
    Match.value(Binary.abs(base)).pipe(
      Match.when(Number.greaterThan(1), () => 0),
      Match.when(Number.lessThan(1), () => Binary.positiveInfinity),
      Match.orElse(() => Binary.notANumber)
    )),
  Match.when(([, exponent]) => integer(exponent), ([base, exponent]) => integerPower(base, exponent)),
  Match.when(([base]) => Number.lessThan(base, 0), () => Binary.notANumber),
  Match.orElse(([base, exponent]) => exp(Number.multiply(exponent, log(base))))
)

/** Real-valued power with integer dispatch for negative bases. */
export const pow = (base: number, exponent: number): number => power(Tuple.make(base, exponent))

/** Sine using the authorized engine intrinsic's full-range argument reduction. */
export const sin: (value: number) => number = Math.sin

/** Cosine using the authorized engine intrinsic's full-range argument reduction. */
export const cos: (value: number) => number = Math.cos

const atanReduced = (value: number, high: number, low: number): number => {
  const z = Number.multiply(value, value)
  const w = Number.multiply(z, z)
  const even8 = Number.sum(4.97687799461593236017e-2, Number.multiply(w, 1.62858201153657823623e-2))
  const even6 = Number.sum(6.66107313738753120669e-2, Number.multiply(w, even8))
  const even4 = Number.sum(9.09088713343650656196e-2, Number.multiply(w, even6))
  const even2 = Number.sum(1.42857142725034663711e-1, Number.multiply(w, even4))
  const even = Number.multiply(z, Number.sum(3.33333333333329318027e-1, Number.multiply(w, even2)))
  const odd7 = Number.sum(-5.83357013379057348645e-2, Number.multiply(w, -3.65315727442169155270e-2))
  const odd5 = Number.sum(-7.69187620504482999495e-2, Number.multiply(w, odd7))
  const odd3 = Number.sum(-1.11111104054623557880e-1, Number.multiply(w, odd5))
  const odd = Number.multiply(w, Number.sum(-1.99999999998764832476e-1, Number.multiply(w, odd3)))
  return Number.subtract(
    high,
    Number.subtract(Number.subtract(Number.multiply(value, Number.sum(even, odd)), low), value)
  )
}

const atanPositive = Match.type<number>().pipe(
  Match.when(Number.lessThan(7.450580596923828e-9), (value) => value),
  Match.when(Number.lessThan(0.4375), (value) => atanReduced(value, 0, 0)),
  Match.when(
    Number.lessThan(0.6875),
    (value) =>
      atanReduced(
        Number.unsafeDivide(Number.subtract(Number.multiply(2, value), 1), Number.sum(2, value)),
        4.63647609000806093515e-1,
        2.26987774529616870924e-17
      )
  ),
  Match.when(
    Number.lessThan(1.1875),
    (value) =>
      atanReduced(
        Number.unsafeDivide(Number.subtract(value, 1), Number.sum(value, 1)),
        quarterPi,
        3.06161699786838301793e-17
      )
  ),
  Match.when(
    Number.lessThan(2.4375),
    (value) =>
      atanReduced(
        Number.unsafeDivide(Number.subtract(value, 1.5), Number.sum(1, Number.multiply(1.5, value))),
        9.82793723247329054082e-1,
        1.39033110312309984516e-17
      )
  ),
  Match.orElse((value) => atanReduced(Number.unsafeDivide(-1, value), halfPi, 6.12323399573676603587e-17))
)

const arctangent = Match.type<readonly [number, number]>().pipe(
  Match.when(([y, x]) => Boolean.or(Binary.isNaN(y), Binary.isNaN(x)), () => Binary.notANumber),
  Match.when(([y, x]) => Boolean.and(zero(y), negativeSign(x)), ([y]) => withSign(pi, y)),
  Match.when(
    ([y, x]) => Boolean.and(zero(y), Predicate.not(negativeSign)(x)),
    ([y]) => Number.multiply(0, y)
  ),
  Match.when(([y, x]) =>
    Boolean.and(
      Predicate.or(positiveInfinity, negativeInfinity)(y),
      Predicate.or(positiveInfinity, negativeInfinity)(x)
    ), ([y, x]) =>
    withSign(
      Boolean.match(negativeSign(x), {
        onTrue: () => threeQuarterPi,
        onFalse: () => quarterPi
      }),
      y
    )),
  Match.when(([y]) => Predicate.or(positiveInfinity, negativeInfinity)(y), ([y]) => withSign(halfPi, y)),
  Match.when(
    ([, x]) => Predicate.or(positiveInfinity, negativeInfinity)(x),
    ([y, x]) => Boolean.match(negativeSign(x), { onTrue: () => withSign(pi, y), onFalse: () => Number.multiply(0, y) })
  ),
  Match.when(([, x]) => zero(x), ([y]) => withSign(halfPi, y)),
  Match.orElse(([y, x]) => {
    const magnitude = atanPositive(Binary.abs(Number.unsafeDivide(y, x)))
    const quadrantMagnitude = Boolean.match(negativeSign(x), {
      onTrue: () => Number.subtract(pi, magnitude),
      onFalse: () => magnitude
    })
    return withSign(quadrantMagnitude, y)
  })
)

/** Two-argument arctangent with signed-zero and infinity quadrants. */
export const atan2 = (y: number, x: number): number => arctangent(Tuple.make(y, x))

const halfExponential = (magnitude: number): number =>
  Boolean.match(Number.greaterThan(magnitude, 711), {
    onTrue: () => Binary.positiveInfinity,
    onFalse: () => exponentialFinite(magnitude, -1)
  })

/** Hyperbolic sine using a cancellation-aware positive-magnitude formula. */
export const sinh = Match.type<number>().pipe(
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(zero, (value) => value),
  Match.when(positiveInfinity, () => Binary.positiveInfinity),
  Match.when(negativeInfinity, () => Binary.negativeInfinity),
  Match.orElse((value) => {
    const magnitude = Binary.abs(value)
    const result = Match.value(magnitude).pipe(
      Match.when(Number.greaterThan(20), halfExponential),
      Match.orElse((magnitude) => {
        const increment = expm1(magnitude)
        return Number.unsafeDivide(
          Number.multiply(increment, Number.sum(increment, 2)),
          Number.multiply(2, Number.sum(increment, 1))
        )
      })
    )
    return withSign(result, value)
  })
)

/** Hyperbolic cosine using symmetric positive exponentials. */
export const cosh = Match.type<number>().pipe(
  Match.when(Binary.isNaN, () => Binary.notANumber),
  Match.when(Predicate.or(positiveInfinity, negativeInfinity), () => Binary.positiveInfinity),
  Match.when(
    (value) => Number.greaterThan(Binary.abs(value), 20),
    (value) => halfExponential(Binary.abs(value))
  ),
  Match.orElse((value) => {
    const exponential = exp(Binary.abs(value))
    return Number.unsafeDivide(Number.sum(exponential, Number.unsafeDivide(1, exponential)), 2)
  })
)
