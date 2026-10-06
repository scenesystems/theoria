/**
 * Exact dyadic arithmetic and binary64 rounding through Effect's public
 * Number, BigInt, BigDecimal, Schema, and collection APIs.
 *
 * @since 0.4.0
 * @category internal
 */
import {
  BigDecimal,
  BigInt,
  Boolean,
  Chunk,
  Data,
  Iterable,
  Match,
  Number,
  Option,
  Predicate,
  Schema,
  Tuple
} from "effect"

export const positiveInfinity = Option.getOrThrow(Number.parse("Infinity"))
export const negativeInfinity = Number.multiply(positiveInfinity, -1)
export const notANumber = Option.getOrThrow(Number.parse("NaN"))
export const isNaN = (value: number): boolean => Number.Equivalence(value, notANumber)

/** An exact value `coefficient × 2^exponent`. */
export class Dyadic extends Data.Class<{
  readonly coefficient: bigint
  readonly exponent: number
}> {}

const decodeInteger = (value: number): bigint => Option.getOrThrow(BigInt.fromNumber(value))
const encodeInteger = (value: bigint): number => Number.Number(value)

/** Non-negative integer powers without native exponentiation. */
export const integerPower = (base: bigint, exponent: number): bigint =>
  BigInt.multiplyAll(
    Iterable.unfold(Tuple.make(base, exponent), ([factor, remaining]) =>
      Boolean.match(Number.isGreaterThan(remaining, 0), {
        onFalse: Option.none,
        onTrue: () => {
          const bit = Number.remainder(remaining, 2)
          return Option.some(Tuple.make(
            Boolean.match(Number.Equivalence(bit, 1), {
              onTrue: () =>
                factor,
              onFalse: () => 1n
            }),
            Tuple.make(BigInt.multiply(factor, factor), Number.divideUnsafe(Number.subtract(remaining, bit), 2))
          ))
        }
      }))
  )

/** Magnitude with positive zero, and NaN propagation. */
export const abs: (value: number) => number = Match.type<number>().pipe(
  Match.when((value) => Number.Equivalence(value, 0), () => 0),
  Match.when(Number.isLessThan(0), (value) => Number.multiply(value, -1)),
  Match.orElse((value) => value)
)

const positivePowerOfTwo: (exponent: number) => number = Match.type<number>().pipe(
  Match.when(0, () => 1),
  Match.orElse((exponent) => {
    // For integral exponents, round((n - 1) / 2) is floor(n / 2).
    const half = Number.round(Number.divideUnsafe(Number.decrement(exponent), 2), 0)
    const factor = positivePowerOfTwo(half)
    const square = Number.multiply(factor, factor)
    return Boolean.match(Number.Equivalence(exponent, Number.multiply(2, half)), {
      onTrue: () => square,
      onFalse: () => Number.multiply(2, square)
    })
  })
)

/** Exact normal power of two for integral exponents in [-1022, 1023]. */
export const powerOfTwo = (exponent: number): number =>
  Boolean.match(Number.isLessThan(exponent, 0), {
    onTrue: () => Number.divideUnsafe(1, positivePowerOfTwo(Number.multiply(-1, exponent))),
    onFalse: () => positivePowerOfTwo(exponent)
  })

const normalizationSteps = Chunk.map(
  Chunk.make(512, 256, 128, 64, 32, 16, 8, 4, 2, 1),
  (exponent) => Tuple.make(exponent, powerOfTwo(exponent), powerOfTwo(Number.multiply(-1, exponent)))
)

/** Exact magnitude `mantissa × 2^exponent`, with mantissa in [1, 2), for finite nonzero input. */
export const normalize = (value: number): [mantissa: number, exponent: number] => {
  const magnitude = abs(value)
  // Lift subnormals into the normal range exactly before the ten binary
  // search steps. No division may discard low significand bits.
  const initial: [number, number] = Boolean.match(Number.isLessThan(magnitude, 2.2250738585072014e-308), {
    onTrue: () => Tuple.make(Number.multiply(magnitude, 18_014_398_509_481_984), -54),
    onFalse: () => Tuple.make(magnitude, 0)
  })
  const belowOne = Number.isLessThan(magnitude, 1)
  const reduced = Iterable.reduce(normalizationSteps, initial, (state, [step, factor, reciprocal]) => {
    const [mantissa, exponent] = state
    return Boolean.match(belowOne, {
      onTrue: () =>
        Boolean.match(Number.isLessThan(mantissa, reciprocal), {
          onTrue: () => Tuple.make(Number.multiply(mantissa, factor), Number.subtract(exponent, step)),
          onFalse: () => state
        }),
      onFalse: () =>
        Boolean.match(Number.isGreaterThanOrEqualTo(mantissa, factor), {
          onTrue: () => Tuple.make(Number.divideUnsafe(mantissa, factor), Number.sum(exponent, step)),
          onFalse: () => state
        })
    })
  })
  return Boolean.match(Number.isLessThan(Tuple.get(reduced, 0), 1), {
    onTrue: () => Tuple.make(Number.multiply(Tuple.get(reduced, 0), 2), Number.decrement(Tuple.get(reduced, 1))),
    onFalse: () => reduced
  })
}

/** Decomposes a finite nonzero number without inspecting its storage. */
export const decompose = (value: number): Dyadic => {
  const [mantissa, exponent] = normalize(value)
  return new Dyadic({
    coefficient: decodeInteger(Number.multiply(mantissa, 4_503_599_627_370_496)),
    exponent: Number.subtract(exponent, 52)
  })
}

/** Converts a dyadic value to an exact decimal, without decimal input rounding. */
export const toDecimal = (value: Dyadic): BigDecimal.BigDecimal =>
  Boolean.match(Number.isGreaterThanOrEqualTo(value.exponent, 0), {
    onTrue: () => BigDecimal.make(BigInt.multiply(value.coefficient, integerPower(2n, value.exponent)), 0),
    onFalse: () =>
      BigDecimal.make(
        BigInt.multiply(value.coefficient, integerPower(5n, Number.multiply(value.exponent, -1))),
        Number.multiply(value.exponent, -1)
      )
  })

/** Exact decimal value of a finite binary64 input. */
export const exactDecimal = (value: number): BigDecimal.BigDecimal =>
  Boolean.match(Number.Equivalence(value, 0), {
    onTrue: () => BigDecimal.make(0n, 0),
    onFalse: () => {
      const magnitude = toDecimal(decompose(value))
      return Boolean.match(Number.isLessThan(value, 0), {
        onTrue: () => BigDecimal.negate(magnitude),
        onFalse: () => magnitude
      })
    }
  })

/** Decimal conversion preserves the binary64 value, not its shortest spelling. */
export const toBigDecimal = (value: number): Option.Option<BigDecimal.BigDecimal> =>
  Option.map(Option.liftPredicate(Schema.is(Schema.Finite))(value), exactDecimal)

/** Exact integer conversion, including integral values beyond the safe range. */
export const toBigInt = (value: number): Option.Option<bigint> =>
  BigInt.fromNumber(value).pipe(
    Option.orElse(() =>
      Option.liftPredicate(Predicate.and(
        Schema.is(Schema.Finite),
        (value: number) => Number.isGreaterThan(abs(value), 9_007_199_254_740_991)
      ))(value).pipe(Option.map((value) => BigDecimal.scale(exactDecimal(value), 0).value))
    )
  )

const mapInteger = (value: number, operation: (value: BigDecimal.BigDecimal) => BigDecimal.BigDecimal): number =>
  Option.match(BigDecimal.fromNumber(value), {
    onNone: () => value,
    onSome: (decimal) => {
      const result = BigDecimal.toNumberUnsafe(operation(decimal))
      return Boolean.match(Number.Equivalence(result, 0), {
        onTrue: () => Number.multiply(0, value),
        onFalse: () => result
      })
    }
  })

export const floor = (value: number): number => mapInteger(value, BigDecimal.floor)
export const ceil = (value: number): number => mapInteger(value, BigDecimal.ceil)
export const truncate = (value: number): number => mapInteger(value, BigDecimal.truncate)

const bitLength = (value: bigint): number =>
  Iterable.reduce(
    Iterable.unfold(value, (remaining) =>
      Boolean.match(BigInt.isGreaterThan(remaining, 0n), {
        onTrue: () => Option.some(Tuple.make(1, BigInt.divideUnsafe(remaining, 2n))),
        onFalse: Option.none
      })),
    0,
    Number.sum
  )

const roundedSqrt = Match.fn((numerator: bigint, denominator: bigint) => {
  const lower = BigInt.sqrtUnsafe(BigInt.divideUnsafe(numerator, denominator))
  const twiceMidpoint = BigInt.increment(BigInt.multiply(2n, lower))
  const midpointSquare = BigInt.multiply(BigInt.multiply(twiceMidpoint, twiceMidpoint), denominator)
  return Tuple.make(BigInt.Order(BigInt.multiply(4n, numerator), midpointSquare), lower)
}).pipe(
  Match.when(([order]) => Number.Equivalence(order, -1), ([, lower]) => lower),
  Match.when(([order]) => Number.Equivalence(order, 1), ([, lower]) => BigInt.increment(lower)),
  Match.orElse(([, lower]) =>
    Boolean.match(BigInt.Equivalence(BigInt.remainder(lower, 2n), 0n), {
      onTrue: () => lower,
      onFalse: () => BigInt.increment(lower)
    })
  )
)

/** Rounds an exact nonnegative dyadic square root to nearest, ties to even. */
const sqrtDyadic = (value: Dyadic): number =>
  Boolean.match(BigInt.Equivalence(value.coefficient, 0n), {
    onTrue: () => 0,
    onFalse: () => {
      const rootExponent = floor(
        Number.divideUnsafe(Number.sum(Number.decrement(bitLength(value.coefficient)), value.exponent), 2)
      )
      const quantum = Number.max(Number.subtract(rootExponent, 52), -1074)
      const shift = Number.subtract(value.exponent, Number.multiply(2, quantum))
      const numerator = BigInt.multiply(value.coefficient, integerPower(2n, Number.max(shift, 0)))
      const denominator = integerPower(2n, Number.max(Number.multiply(shift, -1), 0))
      const rounded = roundedSqrt(numerator, denominator)
      return BigDecimal.toNumberUnsafe(toDecimal(new Dyadic({ coefficient: rounded, exponent: quantum })))
    }
  })

const sqrtFinitePositive = (value: number): number => {
  const dyadic = decompose(value)
  // A scalar's normalized coefficient always has 53 bits, even when its
  // input is subnormal. Its root is normal: quantum is in [-589, 459].
  const rootExponent = Number.round(Number.divideUnsafe(Number.sum(dyadic.exponent, 51), 2), 0)
  const quantum = Number.subtract(rootExponent, 52)
  const shift = Number.subtract(dyadic.exponent, Number.multiply(2, quantum))
  const factor = Boolean.match(Number.Equivalence(shift, 52), {
    onTrue: () => 4_503_599_627_370_496n,
    onFalse: () => 9_007_199_254_740_992n
  })
  const rounded = roundedSqrt(BigInt.multiply(dyadic.coefficient, factor), 1n)
  // The rounded integer has at most 53 significant bits (or is 2^53).
  // Scaling it into the normal range is exact, with no double rounding.
  return Number.multiply(encodeInteger(rounded), powerOfTwo(quantum))
}

/** Principal square root, preserving signed zero and IEEE special values. */
export const sqrt: (value: number) => number = Match.type<number>().pipe(
  Match.when(isNaN, () => notANumber),
  Match.when((value) => Number.Equivalence(value, 0), (value) => value),
  Match.when((value) => Number.Equivalence(value, positiveInfinity), () => positiveInfinity),
  Match.when(Number.isLessThan(0), () => notANumber),
  Match.orElse(sqrtFinitePositive)
)

/** Exact sum-of-squares before final root rounding; infinity dominates NaN. */
export const hypot = (values: Chunk.Chunk<number>): number => {
  const magnitudes = Chunk.map(values, abs)
  return Boolean.match(Chunk.some(magnitudes, (value) => Number.Equivalence(value, positiveInfinity)), {
    onTrue: () => positiveInfinity,
    onFalse: () =>
      Boolean.match(Chunk.some(magnitudes, isNaN), {
        onTrue: () => notANumber,
        onFalse: () =>
          sqrtDyadic(Chunk.reduce(
            Chunk.filter(magnitudes, Predicate.not((value) => Number.Equivalence(value, 0))),
            new Dyadic({ coefficient: 0n, exponent: 0 }),
            (sum, value) => {
              const term = decompose(value)
              const squaredExponent = Number.multiply(2, term.exponent)
              const exponent = Number.min(sum.exponent, squaredExponent)
              return new Dyadic({
                coefficient: BigInt.sum(
                  BigInt.multiply(sum.coefficient, integerPower(2n, Number.subtract(sum.exponent, exponent))),
                  BigInt.multiply(
                    BigInt.multiply(term.coefficient, term.coefficient),
                    integerPower(2n, Number.subtract(squaredExponent, exponent))
                  )
                ),
                exponent
              })
            }
          ))
      })
  })
}
