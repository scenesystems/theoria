/**
 * Pareto direction, dominated-index, and objective-weight helpers.
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
 * Build a uniform `'maximize'` direction vector of length `objectiveCount`.
 *
 * Convenience helper for callers where every objective should be maximized.
 * Pass the result directly as the `directions` argument to any Pareto operator.
 *
 * @see {@link Direction} from `../contracts/Direction` — the per-coordinate optimization sense
 * @see {@link nonDominatedIndices} from `./frontier` — accepts directions
 *
 * @since 0.1.0
 * @category frontier
 */
export const maximizeDirections = (objectiveCount: number): ReadonlyArray<Direction> =>
  Arr.map(buildIndices(objectiveCount), () => "maximize")

/**
 * Returns indices of candidates dominated by at least one member of the non-dominated front.
 *
 * This is the complement of {@link nonDominatedIndices}: every index in `[0, points.length)`
 * appears in exactly one of the two sets.
 *
 * @see {@link nonDominatedIndices} from `./frontier` — the complement set (frontier members)
 * @see {@link frontierSnapshot} Bundles both sets together atomically
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
 * Compute per-candidate weights by counting how many per-objective frontiers include each candidate.
 *
 * A candidate on all `k` objective frontiers receives weight `k`; one on none receives `0`.
 * Higher weight indicates broader competitiveness across objectives and is used by
 * Pareto-parent selection strategies.
 *
 * @see {@link objectiveFrontierHoldings} from `./frontier` — per-objective holdings consumed here
 * @see {@link ObjectiveFrontierWeight} from `./model` — return element type
 * @see {@link objectiveHoldingWeights} Alias with optimizer-aligned naming
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
 * Alias for {@link objectiveFrontierWeights} with naming aligned to optimizer usage.
 *
 * @see {@link objectiveFrontierWeights} Canonical implementation
 * @see {@link ObjectiveFrontierWeight} from `./model` — return element type
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
 * Build a complete {@link FrontierSnapshot} atomically from a single objective matrix.
 *
 * Computes the non-dominated front, dominated complement, per-objective holdings,
 * and per-candidate weights in one pass so all fields are guaranteed consistent
 * with respect to the same input and directions.
 *
 * @see {@link FrontierSnapshot} from `./model` — return type with field documentation
 * @see {@link nonDominatedIndices} from `./frontier` — frontier extraction
 * @see {@link objectiveFrontierHoldings} from `./frontier` — per-objective holdings
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
