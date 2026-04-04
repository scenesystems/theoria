/**
 * GEPA Pareto kernel façade.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
export {
  deriveParentSelectionWeights,
  deriveParetoKernelSnapshot,
  dominatesCandidateVector,
  nonDominatedCandidateIndices,
  perExampleFrontierHoldings
} from "./frontier.js"

export { sampleWeightedParentPair, sampleWeightedParents, selectWeightedParent } from "./sampling.js"
