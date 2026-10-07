/**
 * GEPA per-example holdings and aggregate-ordered redundant-coverage pruning.
 *
 * @see {@link https://arxiv.org/abs/2507.19457 | Agrawal et al., "GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning", 2025}
 * @since 0.1.0
 */
import {
  dominates,
  type Holding,
  maximizeDirections,
  nonDominatedIndices,
  objectiveFrontierHoldings
} from "@scenesystems/effect-search/Pareto"
import { Array as Arr, Boolean, Number as Num, Option, Order } from "effect"

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
): ParentSelectionWeights => deriveParetoKernelSnapshot(scoreVectors).parentWeights

/**
 * Keep an irredundant cover of per-instance maxima, removing lower-aggregate
 * redundant holders first. Raw holdings remain available; parent weights count
 * pruned holdings in first-encounter order, as upstream's frequency dictionary.
 *
 * @since 0.1.0
 * @category combinators
 */
export const deriveParetoKernelSnapshot = (
  scoreVectors: CandidateScoreMatrix
): ParetoKernelSnapshot => {
  const exampleHoldings = perExampleFrontierHoldings(scoreVectors)
  const holders = Arr.dedupe(Arr.flatMap(exampleHoldings, (holding) => holding.holders))
  const ordered = Arr.sort(
    holders,
    Order.mapInput(Num.Order, (index: number) => {
      const scores = Option.getOrThrow(Arr.get(scoreVectors, index))
      return Num.sumAll(scores) / scores.length
    })
  )
  // Once a holder is indispensable, deleting other holders cannot make it redundant.
  const remaining = Arr.reduce(
    ordered,
    ordered,
    (remaining, candidate) =>
      Boolean.match(
        Arr.every(exampleHoldings, (holding) =>
          !Arr.contains(holding.holders, candidate) ||
          Arr.some(holding.holders, (other) => other !== candidate && Arr.contains(remaining, other))),
        {
          onFalse: () => remaining,
          onTrue: () => Arr.filter(remaining, (index) => index !== candidate)
        }
      )
  )
  const parentWeights = Arr.map(
    Arr.filter(holders, (index) => Arr.contains(remaining, index)),
    (candidateIndex) =>
      new ParentSelectionWeight({
        candidateIndex,
        weight: Arr.filter(exampleHoldings, (holding) => Arr.contains(holding.holders, candidateIndex)).length
      })
  )
  return new ParetoKernelSnapshot({
    frontierIndices: Arr.sort(remaining, Num.Order),
    dominatedIndices: Arr.filter(
      Arr.map(scoreVectors, (_, index) => index),
      (index) => !Arr.contains(remaining, index)
    ),
    exampleHoldings,
    parentWeights
  })
}
