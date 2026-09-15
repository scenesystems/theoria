/**
 * Seed normalization and reproducible sampling primitives.
 *
 * @since 0.1.0
 */
import { Numeric } from "@scenesystems/effect-math"
import { Array as Arr, Boolean, Number as Num, Order, Tuple } from "effect"
import type { Schema } from "effect"

const LCG_MULTIPLIER = 1664525
const LCG_INCREMENT = 1013904223
const LCG_MODULUS = 4294967296

/**
 * Converts a numeric seed to a positive integer.
 *
 * @remarks
 * Finite values are truncated after taking their absolute value. Zero,
 * non-finite values, and results below 1 become `1`.
 * @since 0.1.0
 * @category combinators
 */
export const normalizeDeterministicSeed = (seed: number): number => {
  const finite = Boolean.match(Numeric.isFinite(seed), {
    onFalse: () => 1,
    onTrue: () => Numeric.abs(Numeric.truncate(seed))
  })

  return Boolean.match(Num.lessThanOrEqualTo(finite, 0), {
    onFalse: () => finite,
    onTrue: () => 1
  })
}

/**
 * Applies one linear-congruential step modulo `4294967296`.
 *
 * @remarks
 * This operation uses its argument directly. Call
 * {@link normalizeDeterministicSeed} first when accepting an arbitrary numeric
 * seed; negative, fractional, and non-finite inputs otherwise retain JavaScript
 * remainder behavior.
 * @since 0.1.0
 * @category combinators
 */
export const nextDeterministicSeed = (seed: number): number =>
  Num.remainder(
    Num.sum(Num.multiply(seed, LCG_MULTIPLIER), LCG_INCREMENT),
    LCG_MODULUS
  )

/**
 * Converts a numeric count to an integer of at least `1`.
 *
 * @remarks
 * Fractional values are truncated. Non-finite and non-positive values become
 * `1`.
 * @since 0.1.0
 * @category combinators
 */
export const normalizePositiveCount = (value: number): number => {
  const finite = Boolean.match(Numeric.isFinite(value), {
    onFalse: () => 0,
    onTrue: () => Numeric.truncate(value)
  })

  return Boolean.match(Num.lessThanOrEqualTo(finite, 0), {
    onFalse: () => finite,
    onTrue: () => 1
  })
}

const normalizeNonNegativeCount = (value: number): number => {
  const finite = Boolean.match(Numeric.isFinite(value), {
    onFalse: () => 0,
    onTrue: () => Numeric.truncate(value)
  })

  return Boolean.match(Num.lessThanOrEqualTo(finite, 0), {
    onFalse: () => finite,
    onTrue: () => 0
  })
}

type ImmutableArray<A> = Schema.Array$<Schema.Schema<A>>["Type"]
type ScoredValue<A> = Schema.Tuple2<typeof Schema.Number, Schema.Schema<A>>["Type"]

/**
 * Builds consecutive zero-based indices up to the normalized count.
 *
 * @remarks
 * Fractional counts are truncated. Non-finite, zero, and negative counts
 * produce an empty array.
 * @since 0.1.0
 * @category combinators
 */
export const buildIndices = (count: number): Schema.Array$<typeof Schema.Number>["Type"] => {
  const normalized = normalizeNonNegativeCount(count)

  return Boolean.match(Num.lessThanOrEqualTo(normalized, 0), {
    onFalse: () => Arr.range(0, Num.decrement(normalized)),
    onTrue: () => Arr.empty<number>()
  })
}

const scoredOrder = <A>(): Order.Order<ScoredValue<A>> => Order.mapInput(Order.number, Tuple.getFirst)

/**
 * Returns a reproducible permutation without modifying the input array.
 *
 * @remarks
 * The seed is normalized, stepped once per element, and each resulting value is
 * used as that element's sort key. This is a deterministic ordering primitive;
 * it does not implement an unbiased Fisher-Yates shuffle.
 *
 * @typeParam A - Element type retained by the returned permutation.
 *
 * @since 0.1.0
 * @category combinators
 */
export const shuffleBySeed = <A>(values: ImmutableArray<A>, seed: number): ImmutableArray<A> => {
  const sampled = Arr.reduce(
    values,
    Tuple.make(normalizeDeterministicSeed(seed), Arr.empty<ScoredValue<A>>()),
    (state, value) => {
      const next = nextDeterministicSeed(Tuple.getFirst(state))

      return Tuple.make(
        next,
        Arr.append(Tuple.getSecond(state), Tuple.make(next, value))
      )
    }
  )

  return Arr.map(Arr.sort(Tuple.getSecond(sampled), scoredOrder<A>()), Tuple.getSecond)
}

/**
 * Selects a reproducible integer from `1` through the normalized maximum, inclusive.
 *
 * @remarks
 * The seed is normalized and stepped once. A fractional maximum is truncated;
 * a non-finite or non-positive maximum yields `1`.
 * @since 0.1.0
 * @category combinators
 */
export const sampleBoundedCount = (seed: number, maxCount: number): number => {
  const upperBound = normalizePositiveCount(maxCount)

  return Num.increment(Num.remainder(nextDeterministicSeed(normalizeDeterministicSeed(seed)), upperBound))
}
