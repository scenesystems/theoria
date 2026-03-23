/**
 * Deterministic pseudo-random helpers for reproducible sampling across
 * MIPROv2 phases.
 *
 * @since 0.0.0
 * @internal
 */
import * as Sampler from "effect-search/Sampler"

/**
 * Normalizes a seed to a deterministic positive integer suitable for
 * pseudo-random generation.
 *
 * @since 0.0.0
 * @category utils
 */
export const normalizeSeed = (seed: number): number => Sampler.normalizeDeterministicSeed(seed)

/**
 * Clamps a count to at least 1, ensuring sampling loops always produce at
 * least one element.
 *
 * @since 0.0.0
 * @category utils
 */
export const normalizeCount = (value: number): number => Sampler.normalizePositiveCount(value)

/**
 * Produces an array of zero-based indices `[0, 1, …, count - 1]`.
 * Returns an empty array when `count` is zero or negative.
 *
 * @since 0.0.0
 * @category constructors
 */
export const buildIndices = (count: number): ReadonlyArray<number> => Sampler.buildIndices(count)

/**
 * Deterministically shuffles an array using a seeded permutation.
 * The same seed always yields the same ordering, enabling reproducible
 * candidate generation across phases.
 *
 * @since 0.0.0
 * @category utils
 */
export const shuffleBySeed = <A>(values: ReadonlyArray<A>, seed: number): ReadonlyArray<A> =>
  Sampler.shuffleBySeed(values, seed)

/**
 * Derives a demo count from a seed, bounded between 1 and `maxCount`
 * (inclusive). Used to vary the number of demos in shuffled bootstrap
 * candidates.
 *
 * @since 0.0.0
 * @category utils
 */
export const sampleBoundedCount = (seed: number, maxCount: number): number => Sampler.sampleBoundedCount(seed, maxCount)
