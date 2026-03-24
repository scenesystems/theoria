/**
 * Pareto dominance, frontier extraction, and 2D hypervolume utilities.
 *
 * @since 0.1.0
 */

export {
  /**
   * @since 0.1.0
   * @category models
   */
  FrontierSnapshot,
  /**
   * @since 0.1.0
   * @category models
   */
  ObjectiveFrontierHolding,
  /**
   * @since 0.1.0
   * @category models
   */
  ObjectiveFrontierWeight,
  /**
   * @since 0.1.0
   * @category models
   */
  ObjectiveVectorSchema
} from "./model.js"

export type {
  /**
   * @since 0.1.0
   * @category models
   */
  ObjectiveVector
} from "./model.js"

export {
  /**
   * @since 0.1.0
   * @category models
   */
  ObjectiveWeightsSchema
} from "./multiObjective.js"

export type {
  /**
   * @since 0.1.0
   * @category models
   */
  ObjectiveWeights
} from "./multiObjective.js"

export {
  /**
   * @since 0.1.0
   * @category dominance
   */
  dominates
} from "./dominance.js"

export {
  /**
   * @since 0.1.0
   * @category frontier
   */
  dominatedIndices,
  /**
   * @since 0.1.0
   * @category frontier
   */
  frontierSnapshot,
  /**
   * @since 0.1.0
   * @category frontier
   */
  maximizeDirections,
  /**
   * @since 0.1.0
   * @category frontier
   */
  objectiveFrontierWeights,
  /**
   * @since 0.1.0
   * @category frontier
   */
  objectiveHoldingWeights
} from "./weights.js"

export {
  /**
   * @since 0.1.0
   * @category frontier
   */
  nonDominatedIndices,
  /**
   * @since 0.1.0
   * @category frontier
   */
  nonDominatedRanks,
  /**
   * @since 0.1.0
   * @category frontier
   */
  nonDominatedSort,
  /**
   * @since 0.1.0
   * @category frontier
   */
  objectiveFrontierHoldings
} from "./frontier.js"

export {
  /**
   * @since 0.1.0
   * @category hypervolume
   */
  computeMultiObjectiveWeights,
  /**
   * @since 0.1.0
   * @category hypervolume
   */
  computeReferencePoint
} from "./multiObjective.js"

export {
  /**
   * @since 0.1.0
   * @category hypervolume
   */
  hypervolume2d,
  /**
   * @since 0.1.0
   * @category hypervolume
   */
  hypervolumeContribution2d
} from "./hypervolume.js"
