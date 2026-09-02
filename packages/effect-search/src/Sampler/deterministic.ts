/**
 * Seed normalization and reproducible sampling primitives.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Order } from "effect"

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
  const finite = Number.isFinite(seed)
    ? Math.abs(Math.trunc(seed))
    : 1

  return Match.value(finite).pipe(
    Match.when((value) => value <= 0, () => 1),
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
export const nextDeterministicSeed = (seed: number): number => ((seed * LCG_MULTIPLIER) + LCG_INCREMENT) % LCG_MODULUS

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
  const finite = Number.isFinite(value)
    ? Math.trunc(value)
    : 0

  return Match.value(finite).pipe(
    Match.when((count) => count <= 0, () => 1),
    Match.orElse((count) => count)
  )
}

const normalizeNonNegativeCount = (value: number): number => {
  const finite = Number.isFinite(value)
    ? Math.trunc(value)
    : 0

  return Match.value(finite).pipe(
    Match.when((count) => count <= 0, () => 0),
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
export const buildIndices = (count: number): ReadonlyArray<number> => {
  const normalized = normalizeNonNegativeCount(count)

  return Match.value(normalized <= 0).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.range(0, normalized - 1))
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
export const shuffleBySeed = <A>(values: ReadonlyArray<A>, seed: number): ReadonlyArray<A> => {
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

  return (nextDeterministicSeed(normalizeDeterministicSeed(seed)) % upperBound) + 1
}
