/**
 * Pareto comparison and ranking for multi-objective studies, including the
 * two-dimensional hypervolume used by MOTPE weighting.
 *
 * @since 0.1.0
 * @module
 */

export { FrontierSnapshot, ObjectiveFrontierHolding, ObjectiveFrontierWeight, ObjectiveVectorSchema } from "./model.js"

export type { ObjectiveVector } from "./model.js"

export { ObjectiveWeightsSchema } from "./multiObjective.js"

export type { ObjectiveWeights } from "./multiObjective.js"

export { dominates } from "./dominance.js"

export {
  dominatedIndices,
  frontierSnapshot,
  maximizeDirections,
  objectiveFrontierWeights,
  objectiveHoldingWeights
} from "./weights.js"

export { nonDominatedIndices, nonDominatedRanks, nonDominatedSort, objectiveFrontierHoldings } from "./frontier.js"

export { computeMultiObjectiveWeights, computeReferencePoint } from "./multiObjective.js"

export { hypervolume2d, hypervolumeContribution2d } from "./hypervolume.js"
