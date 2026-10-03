/**
 * Deterministic per-trial sampler RNG derivation.
 *
 * @since 0.1.0
 */
import type { Effect } from "effect"
import * as Rng from "../rng.js"
import { normalizeDeterministicSeed } from "./deterministic.js"

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
): Effect.Effect<Rng.Rng> => Rng.make(samplerSeedForTrial(samplerKind, seed, nextTrialNumber))
