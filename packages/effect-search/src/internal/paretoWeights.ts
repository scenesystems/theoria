/**
 * Direction vectors and selection weights derived from Pareto analysis.
 *
 * @since 0.1.0
 */

import { Array as Arr, Boolean as Bool, HashSet, Match, Number as Num } from "effect"

import { type Direction, maximize } from "../Direction.js"
import type { Vector } from "../Objective.js"
import { Frontier, type Holding, HoldingWeight } from "../Pareto.js"
import { nonDominatedIndices, objectiveFrontierHoldings } from "./paretoFrontier.js"

const buildIndices = (
  count: number
) =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.range(0, Num.decrement(count)))
  )

const objectiveWeightsFromHoldings = (
  pointCount: number,
  holdingsInput: Iterable<Holding>
) => {
  const holdings = Arr.fromIterable(holdingsInput)

  const holderSets = Arr.map(holdings, (h) => HashSet.fromIterable(h.holders))

  return Arr.map(buildIndices(pointCount), (candidateIndex) =>
    new HoldingWeight({
      candidateIndex,
      weight: Arr.reduce(
        holderSets,
        0,
        (total, holderSet) =>
          Match.value(HashSet.has(holderSet, candidateIndex)).pipe(
            Match.when(true, () => Num.increment(total)),
            Match.orElse(() => total)
          )
      )
    }))
}

const dominatedIndicesFromFrontier = (
  pointCount: number,
  frontierInput: Iterable<number>
) => {
  const frontier = Arr.fromIterable(frontierInput)

  const frontierSet = HashSet.fromIterable(frontier)

  return Arr.filter(buildIndices(pointCount), (index) => Bool.not(HashSet.has(frontierSet, index)))
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
export const maximizeDirections = (objectiveCount: number) => Arr.map(buildIndices(objectiveCount), () => maximize)

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
  pointsInput: Iterable<Vector>,
  directionsInput: Iterable<Direction> = Arr.empty(),
  epsilon = 0
) => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)

  const frontier = nonDominatedIndices(points, directions, epsilon)

  return dominatedIndicesFromFrontier(Arr.length(points), frontier)
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
  pointsInput: Iterable<Vector>,
  directionsInput: Iterable<Direction> = Arr.empty(),
  epsilon = 0
) => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)

  const holdings = objectiveFrontierHoldings(points, directions, epsilon)

  return objectiveWeightsFromHoldings(Arr.length(points), holdings)
}

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
  pointsInput: Iterable<Vector>,
  directionsInput: Iterable<Direction> = Arr.empty(),
  epsilon = 0
): Frontier => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)

  const frontierIndices = nonDominatedIndices(points, directions, epsilon)
  const objectiveHoldings = objectiveFrontierHoldings(points, directions, epsilon)

  return new Frontier({
    frontierIndices,
    dominatedIndices: dominatedIndicesFromFrontier(Arr.length(points), frontierIndices),
    objectiveHoldings,
    holdingWeights: objectiveWeightsFromHoldings(Arr.length(points), objectiveHoldings)
  })
}
