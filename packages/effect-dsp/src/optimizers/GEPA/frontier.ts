/**
 * GEPA Pareto frontier analysis — non-dominated candidate extraction,
 * per-example holdings, and parent weight derivation via effect-search.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import { Array as Arr, Option } from "effect"
import {
  dominates,
  frontierSnapshot,
  maximizeDirections,
  nonDominatedIndices,
  objectiveFrontierHoldings,
  objectiveHoldingWeights
} from "effect-search/Pareto"

import {
  type CandidateScoreVector,
  ExampleFrontierHolding,
  ParentSelectionWeight,
  ParetoKernelSnapshot
} from "./model.js"

const objectiveCount = (scoreVectors: ReadonlyArray<CandidateScoreVector>): number =>
  Arr.head(scoreVectors).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (scores) => scores.length
    })
  )

const maximizeObjectiveDirections = (scoreVectors: ReadonlyArray<CandidateScoreVector>) =>
  maximizeDirections(objectiveCount(scoreVectors))

const toExampleFrontierHolding = (holding: {
  readonly objectiveIndex: number
  readonly bestValue: number
  readonly holders: ReadonlyArray<number>
}): ExampleFrontierHolding =>
  new ExampleFrontierHolding({
    exampleIndex: holding.objectiveIndex,
    bestScore: holding.bestValue,
    holders: holding.holders
  })

const toParentSelectionWeight = (weight: {
  readonly candidateIndex: number
  readonly weight: number
}): ParentSelectionWeight =>
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
  scoreVectors: ReadonlyArray<CandidateScoreVector>
): ReadonlyArray<number> => nonDominatedIndices(scoreVectors, maximizeObjectiveDirections(scoreVectors))

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
): boolean => dominates(left, right, maximizeDirections(left.length))

/**
 * Compute which candidates hold the best score for each validation example.
 * Used to derive parent selection weights.
 *
 * @since 0.1.0
 * @category combinators
 */
export const perExampleFrontierHoldings = (
  scoreVectors: ReadonlyArray<CandidateScoreVector>
): ReadonlyArray<ExampleFrontierHolding> =>
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
  scoreVectors: ReadonlyArray<CandidateScoreVector>
): ReadonlyArray<ParentSelectionWeight> =>
  Arr.map(objectiveHoldingWeights(scoreVectors, maximizeObjectiveDirections(scoreVectors)), toParentSelectionWeight)

/**
 * Compute a complete Pareto snapshot for one score matrix — frontier indices,
 * dominated set, per-example holdings, and parent weights in a single pass.
 *
 * @since 0.1.0
 * @category combinators
 */
export const deriveParetoKernelSnapshot = (
  scoreVectors: ReadonlyArray<CandidateScoreVector>
): ParetoKernelSnapshot => {
  const directions = maximizeObjectiveDirections(scoreVectors)
  const snapshot = frontierSnapshot(scoreVectors, directions)

  return new ParetoKernelSnapshot({
    frontierIndices: snapshot.frontierIndices,
    dominatedIndices: snapshot.dominatedIndices,
    exampleHoldings: Arr.map(snapshot.objectiveHoldings, toExampleFrontierHolding),
    parentWeights: Arr.map(snapshot.holdingWeights, toParentSelectionWeight)
  })
}
