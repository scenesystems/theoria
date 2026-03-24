/**
 * Shared utility for deriving a deterministic per-trial RNG from the sampler kind, seed, and trial number.
 *
 * @since 0.1.0
 */
import * as Rng from "../../internal/rng.js"
import { normalizeDeterministicSeed } from "../deterministic.js"

/**
 * Derives a deterministic seed string from the sampler kind, base seed, and trial number for reproducible sampling.
 *
 * @since 0.1.0
 * @category utils
 */
export const samplerSeedForTrial = (
  samplerKind: string,
  seed: number,
  nextTrialNumber: number
): string => `${samplerKind}:${normalizeDeterministicSeed(seed)}:${nextTrialNumber}`

/**
 * Creates a per-trial RNG instance seeded deterministically from the sampler kind, base seed, and trial number.
 *
 * @since 0.1.0
 * @category constructors
 */
export const rngByTrial = (
  samplerKind: string,
  seed: number,
  nextTrialNumber: number
): Rng.Rng => Rng.make(samplerSeedForTrial(samplerKind, seed, nextTrialNumber))
