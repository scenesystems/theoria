/**
 * Seed normalization and reproducible sampling primitives.
 *
 * @since 0.1.0
 */
import { abs, truncate } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Data, Match, Number as Num, Order } from "effect"

const lcgMultiplier = 1664525
const lcgIncrement = 1013904223
const lcgModulus = 4294967296

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
  const finite = Match.value(Number.isFinite(seed)).pipe(
    Match.when(true, () => abs(truncate(seed))),
    Match.orElse(() => 1)
  )

  return Match.value(finite).pipe(
    Match.when(Num.lessThanOrEqualTo(0), () => 1),
    Match.orElse((value) => value)
  )
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
  Num.remainder(Num.sum(Num.multiply(seed, lcgMultiplier), lcgIncrement), lcgModulus)

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
  const finite = Match.value(Number.isFinite(value)).pipe(
    Match.when(true, () => truncate(value)),
    Match.orElse(() => 0)
  )

  return Match.value(finite).pipe(
    Match.when(Num.lessThanOrEqualTo(0), () => 1),
    Match.orElse((count) => count)
  )
}

const normalizeNonNegativeCount = (value: number): number => {
  const finite = Match.value(Number.isFinite(value)).pipe(
    Match.when(true, () => truncate(value)),
    Match.orElse(() => 0)
  )

  return Match.value(finite).pipe(
    Match.when(Num.lessThanOrEqualTo(0), () => 0),
    Match.orElse((count) => count)
  )
}

/**
 * Builds consecutive zero-based indices up to the normalized count.
 *
 * @remarks
 * Fractional counts are truncated. Non-finite, zero, and negative counts
 * produce an empty array.
 * @since 0.1.0
 * @category combinators
 */
export const buildIndices = (count: number) => {
  const normalized = normalizeNonNegativeCount(count)

  return Match.value(Num.lessThanOrEqualTo(normalized, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.range(0, Num.decrement(normalized)))
  )
}

const scoredOrder = <A>(): Order.Order<readonly [number, A]> => Order.mapInput(Order.number, ([score]) => score)

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
export const shuffleBySeed = <A>(valuesInput: Iterable<A>, seed: number) => {
  const values = Arr.fromIterable(valuesInput)

  const sampled = Arr.reduce(
    values,
    Data.struct({
      seed: normalizeDeterministicSeed(seed),
      scored: Arr.empty<readonly [number, A]>()
    }),
    (state, value) => {
      const next = nextDeterministicSeed(state.seed)

      return Data.struct({
        seed: next,
        scored: Arr.append(state.scored, Data.tuple(next, value))
      })
    }
  )

  return Arr.map(Arr.sort(sampled.scored, scoredOrder<A>()), ([, value]) => value)
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
