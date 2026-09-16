/**
 * GEPA weighted parent sampling — deterministic index selection routed
 * through effect-search Sampler primitives.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import {
  sampleWeightedIndices,
  sampleWeightedPair,
  type SampleWeightedPairOptions,
  type SelectWeightedIndexOptions,
  selectWeightedIndexWithPolicy
} from "@scenesystems/effect-search/Sampler"
import { Array as Arr } from "effect"

import type { CandidateIndices, ParentPairIndices, ParentSelectionWeights } from "./model.js"

const toWeightedIndices = (weights: ParentSelectionWeights) =>
  Arr.map(weights, (weight) => ({
    index: weight.candidateIndex,
    weight: weight.weight
  }))

/**
 * Select one parent index from weighted candidates using seeded deterministic
 * sampling.
 *
 * @since 0.1.0
 * @category combinators
 */
export const selectWeightedParent = (
  weights: ParentSelectionWeights,
  seed: number,
  options?: SelectWeightedIndexOptions
): number => selectWeightedIndexWithPolicy(toWeightedIndices(weights), seed, options)

/**
 * Sample one deterministic parent pair from weighted candidates, guaranteeing
 * distinct indices.
 *
 * @since 0.1.0
 * @category combinators
 */
export const sampleWeightedParentPair = (
  weights: ParentSelectionWeights,
  seed: number,
  options?: SampleWeightedPairOptions
): ParentPairIndices => sampleWeightedPair(toWeightedIndices(weights), seed, options)

/**
 * Sample multiple parent indices deterministically for distribution analysis
 * or replay.
 *
 * @since 0.1.0
 * @category combinators
 */
export const sampleWeightedParents = (
  weights: ParentSelectionWeights,
  drawCount: number,
  seed: number
): CandidateIndices => sampleWeightedIndices(toWeightedIndices(weights), drawCount, seed)
