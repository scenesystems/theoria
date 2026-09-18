/**
 * GEPA Pareto frontier analysis — non-dominated candidate extraction,
 * per-example holdings, and parent weight derivation via effect-search.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import {
  dominates,
  frontier,
  type Holding,
  type HoldingWeight,
  maximizeDirections,
  nonDominatedIndices,
  objectiveFrontierHoldings,
  objectiveFrontierWeights
} from "@scenesystems/effect-search/Pareto"
import { Array as Arr, Option } from "effect"

import {
  type CandidateIndices,
  type CandidateScoreMatrix,
  type CandidateScoreVector,
  ExampleFrontierHolding,
  ParentSelectionWeight,
  type ParentSelectionWeights,
  ParetoKernelSnapshot
} from "./model.js"

const objectiveCount = (scoreVectors: CandidateScoreMatrix): number =>
  Arr.head(scoreVectors).pipe(
    Option.match({
      onNone: () => 0,
      onSome: Arr.length
    })
  )

const maximizeObjectiveDirections = (scoreVectors: CandidateScoreMatrix) =>
  maximizeDirections(objectiveCount(scoreVectors))

const toExampleFrontierHolding = (holding: Holding): ExampleFrontierHolding =>
  new ExampleFrontierHolding({
    exampleIndex: holding.objectiveIndex,
    bestScore: holding.bestValue,
    holders: holding.holders
  })

const toParentSelectionWeight = (weight: HoldingWeight): ParentSelectionWeight =>
  new ParentSelectionWeight({
    candidateIndex: weight.candidateIndex,
    weight: weight.weight
  })

/**
 * Extract Pareto-optimal candidate indices from a score matrix. Dominance
 * uses maximize-all-examples semantics — a candidate is non-dominated when
 * no other candidate scores strictly better on every example.
 *
 * @since 0.1.0
 * @category combinators
 */
export const nonDominatedCandidateIndices = (
  scoreVectors: CandidateScoreMatrix
): CandidateIndices => nonDominatedIndices(scoreVectors, maximizeObjectiveDirections(scoreVectors))

/**
 * Reports whether the left score vector Pareto-dominates the right under
 * maximize-all semantics.
 *
 * @since 0.1.0
 * @category combinators
 */
export const dominatesCandidateVector = (
  left: CandidateScoreVector,
  right: CandidateScoreVector
): boolean => dominates(left, right, maximizeDirections(Arr.length(left)))

/**
 * Compute which candidates hold the best score for each validation example.
 * Used to derive parent selection weights.
 *
 * @since 0.1.0
 * @category combinators
 */
export const perExampleFrontierHoldings = (
  scoreVectors: CandidateScoreMatrix
): ParetoKernelSnapshot["exampleHoldings"] =>
  Arr.map(objectiveFrontierHoldings(scoreVectors, maximizeObjectiveDirections(scoreVectors)), toExampleFrontierHolding)

/**
 * Derive parent selection weights from per-example frontier holdings. A
 * candidate's weight equals the number of examples where it holds the best
 * score.
 *
 * @since 0.1.0
 * @category combinators
 */
export const deriveParentSelectionWeights = (
  scoreVectors: CandidateScoreMatrix
): ParentSelectionWeights =>
  Arr.map(objectiveFrontierWeights(scoreVectors, maximizeObjectiveDirections(scoreVectors)), toParentSelectionWeight)

/**
 * Compute a complete Pareto snapshot for one score matrix — frontier indices,
 * dominated set, per-example holdings, and parent weights in a single pass.
 *
 * @since 0.1.0
 * @category combinators
 */
export const deriveParetoKernelSnapshot = (
  scoreVectors: CandidateScoreMatrix
): ParetoKernelSnapshot => {
  const directions = maximizeObjectiveDirections(scoreVectors)
  const snapshot = frontier(scoreVectors, directions)

  return new ParetoKernelSnapshot({
    frontierIndices: snapshot.frontierIndices,
    dominatedIndices: snapshot.dominatedIndices,
    exampleHoldings: Arr.map(snapshot.objectiveHoldings, toExampleFrontierHolding),
    parentWeights: Arr.map(snapshot.holdingWeights, toParentSelectionWeight)
  })
}
