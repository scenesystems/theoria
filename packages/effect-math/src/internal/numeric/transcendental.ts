/**
 * Deterministic transcendental kernels assembled from Effect's public
 * arithmetic, decimal, collection, matching, and schema APIs.
 *
 * @since 0.1.0
 * @category internal
 */
import { BigDecimal, Boolean, Chunk, Data, Iterable, Match, Number, Option, Predicate, Schema, Tuple } from "effect"

import * as Binary from "./binary.js"

const lnTwo = 0.6931471805599453
const sqrtTwo = 1.4142135623730951
const halfPi = 1.5707963267948966
const quarterPi = 0.7853981633974483
const threeQuarterPi = 2.356194490192345
const pi = 3.141592653589793
const maxSafeInteger = 9_007_199_254_740_991
const logarithmTerms = 36
const smallSeriesTerms = 72
const exponentialTerms = 28
const arctangentTerms = 52
const trigonometricTerms = 18

// FDLIBM logarithm/exponential rational approximations (OpenLibm e_log.c/e_exp.c).
// Copyright (C) 1993, 2004 by Sun Microsystems, Inc. All rights reserved.
// Developed at SunSoft, a Sun Microsystems, Inc. business.
// Permission to use, copy, modify, and distribute this software is freely
// granted, provided that this notice is preserved.
const lnTwoHigh = 6.93147180369123816490e-1
const lnTwoLow = 1.90821492927058770002e-10
const logarithmEvenCoefficients = Chunk.make(1.531383769920937332e-1, 2.222219843214978396e-1, 3.999999999940941908e-1)
const logarithmOddCoefficients = Chunk.make(
  1.479819860511658591e-1,
  1.818357216161805012e-1,
  2.857142874366239149e-1,
  6.666666666666735130e-1
)
const exponentialCoefficients = Chunk.make(
  4.13813679705723846039e-8,
  -1.65339022054652515390e-6,
  6.61375632143793436117e-5,
  -2.77777777770155933842e-3,
  1.66666666666666019037e-1
)
const horner = (coefficients: Chunk.Chunk<number>, value: number): number =>
  Chunk.reduce(coefficients, 0, (result, coefficient) => Number.sum(Number.multiply(result, value), coefficient))

// Decimal expansions are the constants defined by NIST DLMF §§3.12 and 4.2;
// the additional digits are the linked OEIS reference values A002162/A002392.
const lnTwoDecimal = BigDecimal.unsafeFromString(
  "0.693147180559945309417232121458176568075500134360255254120680009493393621969694715605863326996418687542001481"
)
const lnTenDecimal = BigDecimal.unsafeFromString(
  "2.302585092994045684017991454684364207601101488628772976033327900967572609677352480235997205089598298341967784"
)

const finite = Schema.is(Schema.Number.pipe(Schema.finite()))
// Every finite binary64 value above the safe-integer range is integral.
const integer = Predicate.or(
  Schema.is(Schema.Int),
  Predicate.and(finite, (value: number) => Number.greaterThan(Binary.abs(value), maxSafeInteger))
)
const zero = (value: number): boolean => Number.Equivalence(value, 0)
const positiveInfinity = (value: number): boolean => Number.Equivalence(value, Binary.positiveInfinity)
const negativeInfinity = (value: number): boolean => Number.Equivalence(value, Binary.negativeInfinity)
const negativeZero = (value: number): boolean =>
  Predicate.and(zero, (value: number) => negativeInfinity(Number.unsafeDivide(1, value)))(value)
const negativeSign = Predicate.or(Number.lessThan(0), negativeZero)
const withSign = (magnitude: number, sign: number): number =>
  Boolean.match(negativeSign(sign), { onTrue: () => Number.negate(magnitude), onFalse: () => magnitude })

class TrigSeriesState extends Data.Class<{
  readonly cosine: number
  readonly cosineTerm: number
  readonly index: number
  readonly sine: number
  readonly sineTerm: number
}> {}

class DecimalSeriesState extends Data.Class<{
  readonly denominator: number
  readonly term: BigDecimal.BigDecimal
  readonly total: BigDecimal.BigDecimal
}> {}

const decimalGuard = (value: BigDecimal.BigDecimal): BigDecimal.BigDecimal =>
  BigDecimal.round(value, { mode: "half-even", scale: 110 })

const logarithmFinitePositive = (value: number): number => {
  const dyadic = Binary.decompose(value)
  const rawMantissa = Number.unsafeDivide(
    Schema.encodeSync(Schema.BigIntFromNumber)(dyadic.coefficient),
    4_503_599_627_370_496
  )
  const [mantissa, exponent] = Boolean.match(Number.greaterThanOrEqualTo(rawMantissa, 1.4142112731933594), {
    onTrue: () => Tuple.make(Number.unsafeDivide(rawMantissa, 2), Number.sum(dyadic.exponent, 53)),
    onFalse: () => Tuple.make(rawMantissa, Number.sum(dyadic.exponent, 52))
  })
  const f = Number.subtract(mantissa, 1)
  const s = Number.unsafeDivide(f, Number.sum(2, f))
  const z = Number.multiply(s, s)
  const w = Number.multiply(z, z)
  const remainder = Number.sum(
    Number.multiply(w, horner(logarithmEvenCoefficients, w)),
    Number.multiply(z, horner(logarithmOddCoefficients, w))
  )
  const halfSquare = Number.multiply(0.5, Number.multiply(f, f))
  return Number.subtract(
    Number.multiply(exponent, lnTwoHigh),
    Number.subtract(
      Number.subtract(
        halfSquare,
        Number.sum(Number.multiply(s, Number.sum(halfSquare, remainder)), Number.multiply(exponent, lnTwoLow))
      ),
      f
    )
  )
}

const logarithmDecimalFinitePositive = (value: number): BigDecimal.BigDecimal => {
  const dyadic = Binary.decompose(value)
  const rawMantissaDecimal = BigDecimal.unsafeDivide(
    BigDecimal.make(dyadic.coefficient, 0),
    BigDecimal.make(4_503_599_627_370_496n, 0)
  )
  const rawMantissa = BigDecimal.unsafeToNumber(rawMantissaDecimal)
  const rawExponent = Number.sum(dyadic.exponent, 52)
  const normalized = Boolean.match(Number.greaterThan(rawMantissa, sqrtTwo), {
    onTrue: () =>
      Tuple.make(BigDecimal.unsafeDivide(rawMantissaDecimal, BigDecimal.make(2n, 0)), Number.increment(rawExponent)),
    onFalse: () => Tuple.make(rawMantissaDecimal, rawExponent)
  })
  const normalizedMantissa = Tuple.getFirst(normalized)
  const normalizedExponent = Tuple.getSecond(normalized)
  const z = BigDecimal.unsafeDivide(
    BigDecimal.subtract(normalizedMantissa, BigDecimal.make(1n, 0)),
    BigDecimal.sum(normalizedMantissa, BigDecimal.make(1n, 0))
  )
  const zSquared = BigDecimal.multiply(z, z)
  const series = Iterable.reduce(
    Iterable.take(Iterable.makeBy(() => 0), logarithmTerms),
    new DecimalSeriesState({ denominator: 1, term: z, total: BigDecimal.make(0n, 0) }),
    (state) =>
      new DecimalSeriesState({
        denominator: Number.sum(state.denominator, 2),
        term: decimalGuard(BigDecimal.multiply(state.term, zSquared)),
        total: decimalGuard(
          BigDecimal.sum(
            state.total,
            BigDecimal.unsafeDivide(state.term, BigDecimal.unsafeFromNumber(state.denominator))
          )
        )
      })
  )
  return BigDecimal.sum(
    BigDecimal.multiply(BigDecimal.make(2n, 0), series.total),
    BigDecimal.multiply(BigDecimal.unsafeFromNumber(normalizedExponent), lnTwoDecimal)
  )
}

/** Natural logarithm with IEEE exceptional-value behavior. */
export const log = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Binary.isNaN, () => Binary.notANumber),
    Match.when(positiveInfinity, () => Binary.positiveInfinity),
    Match.when(zero, () => Binary.negativeInfinity),
    Match.when(Number.lessThan(0), () => Binary.notANumber),
    Match.orElse(logarithmFinitePositive)
  )

/**
 * Reproducible binary64 logarithm for deterministic numerical policies.
 * Keeps the established 24-term accumulation order and [1, 2) reduction so
 * seeded consumers retain their decisions, without storage inspection.
 */
export const logStrict = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Binary.isNaN, () => Binary.notANumber),
    Match.when(positiveInfinity, () => Binary.positiveInfinity),
    Match.when(zero, () => Binary.negativeInfinity),
    Match.when(Number.lessThan(0), () => Binary.notANumber),
    Match.orElse((value) => {
      const dyadic = Binary.decompose(value)
      const mantissa = Number.unsafeDivide(
        Schema.encodeSync(Schema.BigIntFromNumber)(dyadic.coefficient),
        4_503_599_627_370_496
      )
      const z = Number.unsafeDivide(Number.subtract(mantissa, 1), Number.sum(mantissa, 1))
      const square = Number.multiply(z, z)
      const [, , total] = Iterable.reduce(
        Iterable.take(Iterable.makeBy(() => 0), 24),
        Tuple.make(1, z, 0),
        ([denominator, term, total]) =>
          Tuple.make(
            Number.sum(denominator, 2),
            Number.multiply(term, square),
            Number.sum(total, Number.unsafeDivide(term, denominator))
          )
      )
      return Number.sum(Number.multiply(2, total), Number.multiply(Number.sum(dyadic.exponent, 52), lnTwo))
    })
  )

const alternatingSeries = (value: number): number => {
  const [, , total] = Iterable.reduce(
    Iterable.take(Iterable.makeBy(Number.increment), smallSeriesTerms),
    Tuple.make(0, value, 0),
    ([compensation, term, previousTotal], index) => {
      const adjusted = Number.subtract(Number.unsafeDivide(term, index), compensation)
      const total = Number.sum(previousTotal, adjusted)
      return Tuple.make(
        Number.subtract(Number.subtract(total, previousTotal), adjusted),
        Number.negate(Number.multiply(term, value)),
        total
      )
    }
  )
  return total
}

/** Cancellation-aware `ln(1 + x)`. */
export const log1p = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Binary.isNaN, () => Binary.notANumber),
    Match.when(zero, (value) => value),
    Match.when((value) => Number.Equivalence(value, -1), () => Binary.negativeInfinity),
    Match.when(Number.lessThan(-1), () => Binary.notANumber),
    Match.when(positiveInfinity, () => Binary.positiveInfinity),
    Match.when((value) => Number.lessThanOrEqualTo(Binary.abs(value), 0.5), alternatingSeries),
    Match.orElse((value) => log(Number.sum(1, value)))
  )

/** Strict precision-policy kernel for `ln(1 + x)`. */
export const log1pStrict: (value: number) => number = log1p

/** Relaxed precision-policy kernel; native composition is shared by both modes. */
export const log1pRelaxed: (value: number) => number = log1p

const exponentialReduced = (value: number): BigDecimal.BigDecimal => {
  const exponent = Binary.floor(Number.sum(Number.unsafeDivide(value, lnTwo), 0.5))
  const reduced = BigDecimal.subtract(
    Binary.exactDecimal(value),
    BigDecimal.multiply(BigDecimal.unsafeFromNumber(exponent), lnTwoDecimal)
  )
  const series = Iterable.reduce(
    Iterable.take(Iterable.makeBy(() => 0), exponentialTerms),
    new DecimalSeriesState({ denominator: 0, term: BigDecimal.make(1n, 0), total: BigDecimal.make(0n, 0) }),
    (state) =>
      new DecimalSeriesState({
        denominator: Number.increment(state.denominator),
        term: decimalGuard(BigDecimal.unsafeDivide(
          BigDecimal.multiply(state.term, reduced),
          BigDecimal.unsafeFromNumber(Number.increment(state.denominator))
        )),
        total: decimalGuard(BigDecimal.sum(state.total, state.term))
      })
  )
  const scale = Binary.toDecimal(new Binary.Dyadic({ coefficient: 1n, exponent }))
  return BigDecimal.multiply(series.total, scale)
}

// FDLIBM identifies unity as a rounding-sensitive point. Compute Euler's
// number once using the decimal series, rather than rounding its rational
// approximation upward at each call.
const eulerNumber = BigDecimal.unsafeToNumber(exponentialReduced(1))

const exponentialFinite = (value: number): number => {
  const exponent = Number.round(Number.multiply(value, 1.44269504088896338700), 0)
  const high = Number.subtract(value, Number.multiply(exponent, lnTwoHigh))
  const low = Number.multiply(exponent, lnTwoLow)
  const reduced = Number.subtract(high, low)
  const square = Number.multiply(reduced, reduced)
  const correction = Number.subtract(reduced, Number.multiply(square, horner(exponentialCoefficients, square)))
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
  const factor = Boolean.match(Number.lessThan(exponent, 0), { onTrue: () => 0.5, onFalse: () => 2 })
  return Number.multiply(
    result,
    Number.multiplyAll(Iterable.take(Iterable.makeBy(() => factor), Binary.abs(exponent)))
  )
}

/** Exponential with range reduction by ln(2) and exact dyadic rescaling. */
export const exp = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Binary.isNaN, () => Binary.notANumber),
    Match.when(positiveInfinity, () => Binary.positiveInfinity),
    Match.when(negativeInfinity, () => 0),
    Match.when(Number.greaterThan(710), () => Binary.positiveInfinity),
    Match.when(Number.lessThan(-746), () => 0),
    Match.when((value) => Number.Equivalence(value, 1), () => eulerNumber),
    Match.when(
      (value) => Number.greaterThan(Binary.abs(value), 700),
      (value) => BigDecimal.unsafeToNumber(exponentialReduced(value))
    ),
    Match.orElse(exponentialFinite)
  )

const expm1Series = (value: number): number => {
  const [, , total] = Iterable.reduce(
    Iterable.take(Iterable.makeBy(Number.increment), smallSeriesTerms),
    Tuple.make(0, value, 0),
    ([compensation, term, previousTotal], index) => {
      const adjusted = Number.subtract(term, compensation)
      const total = Number.sum(previousTotal, adjusted)
      return Tuple.make(
        Number.subtract(Number.subtract(total, previousTotal), adjusted),
        Number.unsafeDivide(Number.multiply(term, value), Number.increment(index)),
        total
      )
    }
  )
  return total
}

/** Cancellation-aware `exp(x) - 1`. */
export const expm1 = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Binary.isNaN, () => Binary.notANumber),
    Match.when(zero, (value) => value),
    Match.when(positiveInfinity, () => Binary.positiveInfinity),
    Match.when(negativeInfinity, () => -1),
    Match.when((value) => Number.lessThanOrEqualTo(Binary.abs(value), 0.5), expm1Series),
    Match.orElse((value) => Number.subtract(exp(value), 1))
  )

/** Strict precision-policy kernel for `exp(x) - 1`. */
export const expm1Strict: (value: number) => number = expm1

/** Relaxed precision-policy kernel; native composition is shared by both modes. */
export const expm1Relaxed: (value: number) => number = expm1

/** Base-10 logarithm derived from a high-precision logarithm quotient. */
export const log10 = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Binary.isNaN, () => Binary.notANumber),
    Match.when(positiveInfinity, () => Binary.positiveInfinity),
    Match.when(zero, () => Binary.negativeInfinity),
    Match.when(Number.lessThan(0), () => Binary.notANumber),
    Match.orElse((value) =>
      BigDecimal.unsafeToNumber(BigDecimal.unsafeDivide(logarithmDecimalFinitePositive(value), lnTenDecimal))
    )
  )

const oddInteger = (value: number): boolean =>
  Boolean.match(Schema.is(Schema.Int)(value), {
    onFalse: () => false,
    onTrue: () => Number.Equivalence(Number.remainder(Binary.abs(value), 2), 1)
  })

const positiveIntegerPower = (base: number, exponent: number): number => {
  const initial = Tuple.make(1, exponent, base)
  const [accumulator] = Iterable.reduce(
    Iterable.unfold(initial, ([accumulator, exponent, factor]) =>
      Boolean.match(Number.greaterThan(exponent, 0), {
        onFalse: Option.none,
        onTrue: () => {
          const odd = oddInteger(exponent)
          const next = Tuple.make(
            Boolean.match(odd, {
              onTrue: () => Number.multiply(accumulator, factor),
              onFalse: () => accumulator
            }),
            Number.unsafeDivide(
              Number.subtract(exponent, Boolean.match(odd, { onTrue: () => 1, onFalse: () => 0 })),
              2
            ),
            Number.multiply(factor, factor)
          )
          return Option.some(Tuple.make(next, next))
        }
      })),
    initial,
    (_, state) => state
  )
  return accumulator
}

const integerPower = (base: number, exponent: number): number =>
  Boolean.match(Number.lessThan(exponent, 0), {
    onTrue: () => positiveIntegerPower(Number.unsafeDivide(1, base), Number.negate(exponent)),
    onFalse: () => positiveIntegerPower(base, exponent)
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

/** Real-valued power with integer dispatch for negative bases. */
export const pow = (base: number, exponent: number): number =>
  Match.value(Tuple.make(base, exponent)).pipe(
    Match.when(([, exponent]) => zero(exponent), () => 1),
    Match.when(([base, exponent]) => Boolean.or(Binary.isNaN(base), Binary.isNaN(exponent)), () => Binary.notANumber),
    Match.when(([base, exponent]) => Boolean.and(zero(base), Predicate.not(zero)(exponent)), ([base, exponent]) =>
      zeroPower(base, exponent)),
    Match.when(
      ([base, exponent]) =>
        Boolean.and(Predicate.or(positiveInfinity, negativeInfinity)(base), Predicate.not(zero)(exponent)),
      ([base, exponent]) =>
        infinitePower(base, exponent)
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

// The long decimal expansion is from NIST's Statistical Reference Dataset
// PiDigits (https://www.itl.nist.gov/div898/strd/univ/data/PiDigits.html).
// Its 399 fractional digits exceed the 309 decimal integer digits of every
// finite binary64 input, leaving 90 guard digits during argument reduction.
const piDecimal = BigDecimal.unsafeFromString(
  "3.141592653589793238462643383279502884197169399375105820974944592307816406286208998628034825342117067982148086513282306647093844609550582231725359408128481117450284102701938521105559644622948954930381964428810975665933446128475648233786783165271201909145648566923460348610454326648213393607260249141273724587006606315588174881520920962829254091715364367892590360011330530548820466521384146951941511609"
)
const twoPiDecimal = BigDecimal.multiply(piDecimal, BigDecimal.make(2n, 0))
const halfPiDecimal = BigDecimal.multiply(piDecimal, BigDecimal.make(5n, 1))
const quarterPiDecimal = BigDecimal.multiply(piDecimal, BigDecimal.make(25n, 2))
const threeQuarterPiDecimal = BigDecimal.multiply(quarterPiDecimal, BigDecimal.make(3n, 0))

const reducedAngle = (value: number): BigDecimal.BigDecimal => {
  const remainder = BigDecimal.unsafeRemainder(Binary.exactDecimal(value), twoPiDecimal)
  return Match.value(remainder).pipe(
    Match.when(
      (value) => BigDecimal.greaterThan(value, piDecimal),
      (value) => BigDecimal.subtract(value, twoPiDecimal)
    ),
    Match.when(
      (value) => BigDecimal.lessThan(value, BigDecimal.negate(piDecimal)),
      (value) => BigDecimal.sum(value, twoPiDecimal)
    ),
    Match.orElse((value) => value)
  )
}

const trigSeries = (value: number) => {
  const square = Number.multiply(value, value)
  const result = Iterable.reduce(
    Iterable.take(Iterable.makeBy(() => 0), trigonometricTerms),
    new TrigSeriesState({ cosine: 1, cosineTerm: 1, index: 0, sine: value, sineTerm: value }),
    (state) => {
      const twiceIndex = Number.multiply(2, state.index)
      const nextCosineTerm = Number.negate(Number.unsafeDivide(
        Number.multiply(state.cosineTerm, square),
        Number.multiply(Number.increment(twiceIndex), Number.sum(twiceIndex, 2))
      ))
      const nextSineTerm = Number.negate(Number.unsafeDivide(
        Number.multiply(state.sineTerm, square),
        Number.multiply(Number.sum(twiceIndex, 2), Number.sum(twiceIndex, 3))
      ))
      return new TrigSeriesState({
        cosine: Number.sum(state.cosine, nextCosineTerm),
        cosineTerm: nextCosineTerm,
        index: Number.increment(state.index),
        sine: Number.sum(state.sine, nextSineTerm),
        sineTerm: nextSineTerm
      })
    }
  )
  return Tuple.make(result.sine, result.cosine)
}

const sinCosFinite = (value: number) => {
  const principal = reducedAngle(value)
  return Match.value(principal).pipe(
    Match.when(BigDecimal.greaterThan(threeQuarterPiDecimal), (angle) => {
      const [sine, cosine] = trigSeries(BigDecimal.unsafeToNumber(BigDecimal.subtract(piDecimal, angle)))
      return Tuple.make(sine, Number.negate(cosine))
    }),
    Match.when(BigDecimal.greaterThan(quarterPiDecimal), (angle) => {
      const [sine, cosine] = trigSeries(BigDecimal.unsafeToNumber(BigDecimal.subtract(halfPiDecimal, angle)))
      return Tuple.make(cosine, sine)
    }),
    Match.when(BigDecimal.lessThan(BigDecimal.negate(threeQuarterPiDecimal)), (angle) => {
      const [sine, cosine] = trigSeries(
        BigDecimal.unsafeToNumber(BigDecimal.subtract(BigDecimal.negate(piDecimal), angle))
      )
      return Tuple.make(sine, Number.negate(cosine))
    }),
    Match.when(BigDecimal.lessThan(BigDecimal.negate(quarterPiDecimal)), (angle) => {
      const [sine, cosine] = trigSeries(
        BigDecimal.unsafeToNumber(BigDecimal.subtract(BigDecimal.negate(halfPiDecimal), angle))
      )
      return Tuple.make(Number.negate(cosine), Number.negate(sine))
    }),
    Match.orElse((angle) => trigSeries(BigDecimal.unsafeToNumber(angle)))
  )
}

/** Sine with exact-decimal Payne-Hanek-style range reduction. */
export const sin = (value: number): number =>
  Match.value(value).pipe(
    Match.when(zero, (value) => value),
    Match.when(Predicate.not(finite), () => Binary.notANumber),
    Match.orElse((value) => Tuple.getFirst(sinCosFinite(value)))
  )

/** Cosine with exact-decimal Payne-Hanek-style range reduction. */
export const cos = (value: number): number =>
  Match.value(value).pipe(
    Match.when(zero, () => 1),
    Match.when(Predicate.not(finite), () => Binary.notANumber),
    Match.orElse((value) => Tuple.getSecond(sinCosFinite(value)))
  )

const atanSeries = (value: number): number => {
  const square = Number.multiply(value, value)
  const [, , total] = Iterable.reduce(
    Iterable.take(Iterable.makeBy(() => 0), arctangentTerms),
    Tuple.make(1, value, 0),
    ([denominator, term, total]) =>
      Tuple.make(
        Number.sum(denominator, 2),
        Number.negate(Number.multiply(term, square)),
        Number.sum(total, Number.unsafeDivide(term, denominator))
      )
  )
  return total
}

const atanUnit = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Number.greaterThan(0.41421356237309503), (value) =>
      Number.sum(
        quarterPi,
        atanSeries(Number.unsafeDivide(Number.subtract(value, 1), Number.sum(value, 1)))
      )),
    Match.orElse(atanSeries)
  )

const atanPositive = (value: number): number =>
  Match.value(value).pipe(
    Match.when(Number.greaterThan(1), (value) => Number.subtract(halfPi, atanUnit(Number.unsafeDivide(1, value)))),
    Match.orElse(atanUnit)
  )

/** Two-argument arctangent with signed-zero and infinity quadrants. */
export const atan2 = (y: number, x: number): number =>
  Match.value(Tuple.make(y, x)).pipe(
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
      ([y, x]) =>
        Boolean.match(negativeSign(x), { onTrue: () => withSign(pi, y), onFalse: () => Number.multiply(0, y) })
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

const halfExponential = (magnitude: number): number =>
  Boolean.match(Number.greaterThan(magnitude, 711), {
    onTrue: () => Binary.positiveInfinity,
    onFalse: () => BigDecimal.unsafeToNumber(BigDecimal.multiply(exponentialReduced(magnitude), BigDecimal.make(5n, 1)))
  })

/** Hyperbolic sine using a cancellation-aware positive-magnitude formula. */
export const sinh = (value: number): number =>
  Match.value(value).pipe(
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
export const cosh = (value: number): number =>
  Match.value(value).pipe(
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
