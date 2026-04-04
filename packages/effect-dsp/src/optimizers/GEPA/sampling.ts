/**
 * GEPA weighted parent sampling — deterministic index selection routed
 * through effect-search Sampler primitives.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Array as Arr } from "effect"
import {
  sampleWeightedIndices,
  sampleWeightedPair,
  type SampleWeightedPairOptions,
  type SelectWeightedIndexOptions,
  selectWeightedIndexWithPolicy,
  type WeightedIndex
} from "effect-search/Sampler"

import { type ParentSelectionWeight } from "./model.js"

const toWeightedIndices = (weights: ReadonlyArray<ParentSelectionWeight>): ReadonlyArray<WeightedIndex> =>
  Arr.map(weights, (weight) => ({
    index: weight.candidateIndex,
    weight: weight.weight
  }))

/**
 * Optional controls for single-parent weighted selection — mirrors
 * `SelectWeightedIndexOptions` from effect-search.
 *
 * @since 0.1.0
 * @category models
 */
export type SelectWeightedParentOptions = SelectWeightedIndexOptions

/**
 * Optional controls for parent-pair sampling — mirrors
 * `SampleWeightedPairOptions` from effect-search.
 *
 * @since 0.1.0
 * @category models
 */
export type SampleWeightedParentPairOptions = SampleWeightedPairOptions

/**
 * Select one parent index from weighted candidates using seeded deterministic
 * sampling.
 *
 * @since 0.1.0
 * @category combinators
 */
export const selectWeightedParent = (
  weights: ReadonlyArray<ParentSelectionWeight>,
  seed: number,
  options?: SelectWeightedParentOptions
): number => selectWeightedIndexWithPolicy(toWeightedIndices(weights), seed, options)

/**
 * Sample one deterministic parent pair from weighted candidates, guaranteeing
 * distinct indices.
 *
 * @since 0.1.0
 * @category combinators
 */
export const sampleWeightedParentPair = (
  weights: ReadonlyArray<ParentSelectionWeight>,
  seed: number,
  options?: SampleWeightedParentPairOptions
): readonly [number, number] => sampleWeightedPair(toWeightedIndices(weights), seed, options)

/**
 * Sample multiple parent indices deterministically for distribution analysis
 * or replay.
 *
 * @since 0.1.0
 * @category combinators
 */
export const sampleWeightedParents = (
  weights: ReadonlyArray<ParentSelectionWeight>,
  drawCount: number,
  seed: number
): ReadonlyArray<number> => sampleWeightedIndices(toWeightedIndices(weights), drawCount, seed)
