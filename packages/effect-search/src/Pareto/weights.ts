/**
 * Direction vectors and selection weights derived from Pareto analysis.
 *
 * @since 0.1.0
 */

import { Array as Arr, HashSet } from "effect"

import type { Direction } from "../contracts/Direction.js"
import { nonDominatedIndices, objectiveFrontierHoldings } from "./frontier.js"
import { FrontierSnapshot, ObjectiveFrontierWeight } from "./model.js"
import type { ObjectiveFrontierHolding, ObjectiveVector } from "./model.js"

const buildIndices = (
  count: number
): ReadonlyArray<number> => count <= 0 ? Arr.empty<number>() : Arr.range(0, count - 1)

const objectiveWeightsFromHoldings = (
  pointCount: number,
  holdings: ReadonlyArray<ObjectiveFrontierHolding>
): ReadonlyArray<ObjectiveFrontierWeight> => {
  const holderSets = Arr.map(holdings, (h) => HashSet.fromIterable(h.holders))

  return Arr.map(buildIndices(pointCount), (candidateIndex) =>
    new ObjectiveFrontierWeight({
      candidateIndex,
      weight: Arr.reduce(
        holderSets,
        0,
        (total, holderSet) =>
          HashSet.has(holderSet, candidateIndex)
            ? total + 1
            : total
      )
    }))
}

const dominatedIndicesFromFrontier = (
  pointCount: number,
  frontier: ReadonlyArray<number>
): ReadonlyArray<number> => {
  const frontierSet = HashSet.fromIterable(frontier)

  return Arr.filter(buildIndices(pointCount), (index) => !HashSet.has(frontierSet, index))
}

/**
 * Creates one `"maximize"` direction for each requested objective.
 *
 * @remarks
 * Non-positive counts produce an empty array. Positive fractional counts are truncated,
 * with a minimum result length of one. Callers must supply a finite count; positive
 * infinity causes the underlying array allocation to throw.
 *
 * @since 0.1.0
 * @category frontier
 */
export const maximizeDirections = (objectiveCount: number): ReadonlyArray<Direction> =>
  Arr.map(buildIndices(objectiveCount), () => "maximize")

/**
 * Selects every input index absent from the first non-dominated front.
 *
 * @remarks
 * A ragged matrix has no computed front, so every input index is returned. Indices
 * preserve input order.
 *
 * @since 0.1.0
 * @category frontier
 */
export const dominatedIndices = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): ReadonlyArray<number> => {
  const frontier = nonDominatedIndices(points, directions, epsilon)

  return dominatedIndicesFromFrontier(points.length, frontier)
}

/**
 * Counts how many objective coordinates each candidate holds at the best value.
 *
 * @remarks
 * The result contains one entry per input candidate in input order. A ragged matrix
 * assigns zero to every candidate because it has no coordinate holdings.
 *
 * @since 0.1.0
 * @category frontier
 */
export const objectiveFrontierWeights = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): ReadonlyArray<ObjectiveFrontierWeight> => {
  const holdings = objectiveFrontierHoldings(points, directions, epsilon)

  return objectiveWeightsFromHoldings(points.length, holdings)
}

/**
 * Exposes {@link objectiveFrontierWeights} under the optimizer's holding terminology.
 *
 * @since 0.1.0
 * @category frontier
 */
export const objectiveHoldingWeights = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): ReadonlyArray<ObjectiveFrontierWeight> => objectiveFrontierWeights(points, directions, epsilon)

/**
 * Analyzes one matrix into its first front and exact per-coordinate holdings.
 *
 * @remarks
 * Empty input produces empty fields. For a ragged matrix, `frontierIndices` and
 * `objectiveHoldings` are empty, `dominatedIndices` contains every input index, and
 * every holding weight is zero.
 *
 * @since 0.1.0
 * @category frontier
 */
export const frontierSnapshot = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): FrontierSnapshot => {
  const frontierIndices = nonDominatedIndices(points, directions, epsilon)
  const objectiveHoldings = objectiveFrontierHoldings(points, directions, epsilon)

  return new FrontierSnapshot({
    frontierIndices,
    dominatedIndices: dominatedIndicesFromFrontier(points.length, frontierIndices),
    objectiveHoldings,
    holdingWeights: objectiveWeightsFromHoldings(points.length, objectiveHoldings)
  })
}
