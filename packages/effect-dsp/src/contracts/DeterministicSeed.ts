/**
 * Deterministic PRNG seed helpers delegating to `effect-search/Sampler`.
 * Ensures all optimizer runtimes share the same seed algebra for
 * reproducible trial sequences.
 *
 * @since 0.0.0
 */
import * as Sampler from "effect-search/Sampler"

/**
 * Clamp and normalize a user-provided seed into a positive integer
 * suitable for deterministic sampling. Delegates to `effect-search`.
 *
 * @since 0.0.0
 * @category combinators
 */
export const normalizeDeterministicSeed = (seed: number): number => Sampler.normalizeDeterministicSeed(seed)

/**
 * Advance a deterministic seed by one step, producing the next seed in
 * the sequence. Each optimizer trial calls this to derive a unique,
 * reproducible child seed.
 *
 * @since 0.0.0
 * @category combinators
 */
export const nextDeterministicSeed = (seed: number): number => Sampler.nextDeterministicSeed(seed)
