/**
 * Direction vectors and selection weights derived from Pareto analysis.
 *
 * @since 0.1.0
 */

import { Array as Arr, Boolean, HashSet, Number as Num } from "effect"
import type { Schema } from "effect"

import type { DirectionSchema } from "../contracts/Direction.js"
import { nonDominatedIndices, objectiveFrontierHoldings } from "./frontier.js"
import { FrontierSnapshot, ObjectiveFrontierWeight } from "./model.js"
import type { ObjectiveFrontierHolding, ObjectiveVectorSchema } from "./model.js"

type DirectionArray = Schema.Array$<typeof DirectionSchema>["Type"]
type NumberArray = Schema.Array$<typeof Schema.Number>["Type"]
type ObjectiveMatrix = Schema.Array$<typeof ObjectiveVectorSchema>["Type"]
type ObjectiveHoldings = Schema.Array$<typeof ObjectiveFrontierHolding>["Type"]
type ObjectiveWeights = Schema.Array$<typeof ObjectiveFrontierWeight>["Type"]

const buildIndices = (count: number): NumberArray =>
  Boolean.match(Num.lessThanOrEqualTo(count, 0), {
    onFalse: () => Arr.range(0, Num.decrement(count)),
    onTrue: () => Arr.empty<number>()
  })

const objectiveWeightsFromHoldings = (
  pointCount: number,
  holdings: ObjectiveHoldings
): ObjectiveWeights => {
  const holderSets = Arr.map(holdings, (h) => HashSet.fromIterable(h.holders))

  return Arr.map(buildIndices(pointCount), (candidateIndex) =>
    new ObjectiveFrontierWeight({
      candidateIndex,
      weight: Arr.reduce(
        holderSets,
        0,
        (total, holderSet) =>
          Boolean.match(HashSet.has(holderSet, candidateIndex), {
            onFalse: () => total,
            onTrue: () => Num.increment(total)
          })
      )
    }))
}

const dominatedIndicesFromFrontier = (
  pointCount: number,
  frontier: NumberArray
): NumberArray => {
  const frontierSet = HashSet.fromIterable(frontier)

  return Arr.filter(buildIndices(pointCount), (index) => Boolean.not(HashSet.has(frontierSet, index)))
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
export const maximizeDirections = (objectiveCount: number): DirectionArray =>
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
  points: ObjectiveMatrix,
  directions: DirectionArray = Arr.empty(),
  epsilon = 0
): NumberArray => {
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
  points: ObjectiveMatrix,
  directions: DirectionArray = Arr.empty(),
  epsilon = 0
): ObjectiveWeights => {
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
  points: ObjectiveMatrix,
  directions: DirectionArray = Arr.empty(),
  epsilon = 0
): FrontierSnapshot => {
  const frontierIndices = nonDominatedIndices(points, directions, epsilon)
  const objectiveHoldings = objectiveFrontierHoldings(points, directions, epsilon)

  return new FrontierSnapshot({
    frontierIndices,
    dominatedIndices: dominatedIndicesFromFrontier(Arr.length(points), frontierIndices),
    objectiveHoldings,
    holdingWeights: objectiveWeightsFromHoldings(Arr.length(points), objectiveHoldings)
  })
}
