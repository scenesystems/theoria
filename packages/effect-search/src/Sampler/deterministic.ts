/**
 * Deterministic seed stepping and seeded sampling helpers.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Match, Order } from "effect"

const LCG_MULTIPLIER = 1664525
const LCG_INCREMENT = 1013904223
const LCG_MODULUS = 4294967296

/**
 * Normalize a user-provided seed into a positive deterministic integer.
 * Non-finite values (NaN, ±Infinity) collapse to 1, and zero is clamped
 * to 1 so downstream LCG arithmetic never degenerates.
 *
 * @see {@link nextDeterministicSeed} consumes the normalized seed
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
 * Advance one deterministic linear-congruential-generator step using the
 * Numerical Recipes constants (multiplier 1664525, increment 1013904223,
 * modulus 2³²). The output is a 32-bit unsigned integer suitable for seeding
 * subsequent calls.
 *
 * @see {@link normalizeDeterministicSeed} ensures the input seed is valid
 * @see {@link shuffleBySeed} uses repeated steps to assign sort keys
 * @since 0.1.0
 * @category combinators
 */
export const nextDeterministicSeed = (seed: number): number => ((seed * LCG_MULTIPLIER) + LCG_INCREMENT) % LCG_MODULUS

/**
 * Normalize a count to a positive integer lower-bounded at 1. Non-finite
 * values default to 1 and fractional parts are truncated. Guarantees the
 * result is always ≥ 1, making it safe for use as an array length or
 * iteration bound.
 *
 * @see {@link sampleBoundedCount} uses this for upper-bound normalization
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
 * Build the deterministic index range `[0, 1, ..., count - 1]`. Returns an
 * empty array when `count` is zero or negative. Used to generate candidate
 * indices that are subsequently shuffled or sliced by seeded sampling.
 *
 * @see {@link shuffleBySeed} often applied to the output of this function
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
 * Shuffle values deterministically by seed using a sort-by-score approach:
 * each element is paired with a pseudo-random score derived from successive
 * LCG steps, then the pairs are sorted by score. This produces a stable,
 * reproducible permutation for any given seed without mutating the input.
 *
 * @see {@link nextDeterministicSeed} generates the per-element scores
 * @see {@link normalizeDeterministicSeed} sanitizes the initial seed
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
 * Sample one deterministic count in the closed interval `[1, maxCount]`.
 * The seed is normalized and stepped once via the LCG, then mapped into
 * the target range with modular arithmetic. Always returns at least 1.
 *
 * @see {@link normalizePositiveCount} clamps `maxCount` to ≥ 1
 * @see {@link nextDeterministicSeed} the LCG step used internally
 * @since 0.1.0
 * @category combinators
 */
export const sampleBoundedCount = (seed: number, maxCount: number): number => {
  const upperBound = normalizePositiveCount(maxCount)

  return (nextDeterministicSeed(normalizeDeterministicSeed(seed)) % upperBound) + 1
}
