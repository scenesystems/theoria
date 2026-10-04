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
export const abs = (value: number): number =>
  Match.value(value).pipe(
    Match.when((value) => Number.Equivalence(value, 0), () => 0),
    Match.when(Number.isLessThan(0), (value) => Number.multiply(value, -1)),
    Match.orElse((value) => value)
  )

/** Decomposes a finite nonzero number without inspecting its storage. */
export const decompose = (value: number): Dyadic => {
  const initial: [number, number] = Tuple.make(abs(value), 0)
  const normalized = Iterable.reduce(
    Iterable.unfold(initial, ([mantissa, exponent]) =>
      Match.value(mantissa).pipe(
        Match.when(Number.isGreaterThanOrEqualTo(2), () => {
          const next = Tuple.make(Number.divideUnsafe(mantissa, 2), Number.increment(exponent))
          return Option.some(Tuple.make(next, next))
        }),
        Match.when(Number.isLessThan(1), () => {
          const next = Tuple.make(Number.multiply(mantissa, 2), Number.decrement(exponent))
          return Option.some(Tuple.make(next, next))
        }),
        Match.orElse(() => Option.none())
      )),
    initial,
    (_, next) => next
  )
  return new Dyadic({
    coefficient: decodeInteger(Number.multiply(Tuple.get(normalized, 0), 4_503_599_627_370_496)),
    exponent: Number.subtract(Tuple.get(normalized, 1), 52)
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
      const lower = BigInt.sqrtUnsafe(BigInt.divideUnsafe(numerator, denominator))
      const twiceMidpoint = BigInt.increment(BigInt.multiply(2n, lower))
      const midpointSquare = BigInt.multiply(BigInt.multiply(twiceMidpoint, twiceMidpoint), denominator)
      const fourNumerator = BigInt.multiply(4n, numerator)
      const rounded = Match.value(BigInt.Order(fourNumerator, midpointSquare)).pipe(
        Match.when(-1, () => lower),
        Match.when(1, () => BigInt.increment(lower)),
        Match.when(0, () =>
          Boolean.match(Number.Equivalence(Number.remainder(encodeInteger(lower), 2), 0), {
            onTrue: () => lower,
            onFalse: () => BigInt.increment(lower)
          })),
        Match.exhaustive
      )
      return BigDecimal.toNumberUnsafe(toDecimal(new Dyadic({ coefficient: rounded, exponent: quantum })))
    }
  })

/** Principal square root, preserving signed zero and IEEE special values. */
export const sqrt = (value: number): number =>
  Match.value(value).pipe(
    Match.when(isNaN, () => notANumber),
    Match.when((value) => Number.Equivalence(value, 0), (value) => value),
    Match.when((value) => Number.Equivalence(value, positiveInfinity), () => positiveInfinity),
    Match.when(Number.isLessThan(0), () => notANumber),
    Match.orElse((value) => sqrtDyadic(decompose(value)))
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
