/**
 * Pareto comparison, ranking, frontier analysis, and hypervolume.
 *
 * @since 0.7.0
 * @module
 */
import { Schema } from "effect"

import { Direction } from "./Direction.js"
import * as Dominance from "./internal/paretoDominance.js"
import * as FrontierOperations from "./internal/paretoFrontier.js"
import * as Hypervolume from "./internal/paretoHypervolume.js"
import * as MultiObjective from "./internal/paretoMultiObjective.js"
import * as WeightsOperations from "./internal/paretoWeights.js"
import type { Vector } from "./Objective.js"

const Fronts = Schema.Array(Schema.Array(Schema.Number))
type Fronts = typeof Fronts.Type
const Directions = Schema.Array(Direction)
type Directions = typeof Directions.Type

/** Best coordinate value and its candidate holders. @since 0.7.0 @category schemas */
export class Holding extends Schema.Class<Holding>("effect-search/Pareto/Holding")({
  objectiveIndex: Schema.Number,
  bestValue: Schema.Number,
  holders: Schema.Array(Schema.Number)
}) {}

/** Number of coordinates held by one candidate. @since 0.7.0 @category schemas */
export class HoldingWeight extends Schema.Class<HoldingWeight>("effect-search/Pareto/HoldingWeight")({
  candidateIndex: Schema.Number,
  weight: Schema.Number
}) {}

/** A complete first-front analysis. @since 0.7.0 @category schemas */
export class Frontier extends Schema.Class<Frontier>("effect-search/Pareto/Frontier")({
  frontierIndices: Schema.Array(Schema.Number),
  dominatedIndices: Schema.Array(Schema.Number),
  objectiveHoldings: Schema.Array(Holding),
  holdingWeights: Schema.Array(HoldingWeight)
}) {}

/** Candidate weights in input order. @since 0.7.0 @category schemas */
export const Weights = Schema.Array(Schema.Number)
/** Candidate weights in input order. @since 0.7.0 @category models */
export type Weights = typeof Weights.Type

const Holdings = Schema.Array(Holding)
type Holdings = typeof Holdings.Type
const HoldingWeights = Schema.Array(HoldingWeight)
type HoldingWeights = typeof HoldingWeights.Type

/** Tests Pareto dominance. @since 0.7.0 @category predicates */
export const dominates = (
  left: Vector,
  right: Vector,
  directions: Iterable<Direction> = [],
  epsilon = 0
): boolean => Dominance.dominates(left, right, directions, epsilon)
/** Returns first-front indices. @since 0.7.0 @category combinators */
export const nonDominatedIndices = (
  points: Iterable<Vector>,
  directions: Iterable<Direction> = [],
  epsilon = 0
): Weights => FrontierOperations.nonDominatedIndices(points, directions, epsilon)
/** Returns all fronts in rank order. @since 0.7.0 @category combinators */
export const nonDominatedSort = (
  points: Iterable<Vector>,
  directions: Iterable<Direction> = [],
  epsilon = 0
): Fronts => FrontierOperations.nonDominatedSort(points, directions, epsilon)
/** Returns one rank per candidate. @since 0.7.0 @category combinators */
export const nonDominatedRanks = (
  points: Iterable<Vector>,
  directions: Iterable<Direction> = [],
  epsilon = 0
): Weights => FrontierOperations.nonDominatedRanks(points, directions, epsilon)
/** Computes exact coordinate holdings. @since 0.7.0 @category combinators */
export const objectiveFrontierHoldings = (
  points: Iterable<Vector>,
  directions: Iterable<Direction> = [],
  epsilon = 0
): Holdings => FrontierOperations.objectiveFrontierHoldings(points, directions, epsilon)
/** Computes dominated candidate indices. @since 0.7.0 @category combinators */
export const dominatedIndices = (
  points: Iterable<Vector>,
  directions: Iterable<Direction> = [],
  epsilon = 0
): Weights => WeightsOperations.dominatedIndices(points, directions, epsilon)
/** Computes a full frontier analysis. @since 0.7.0 @category combinators */
export const frontier = (
  points: Iterable<Vector>,
  directions: Iterable<Direction> = [],
  epsilon = 0
): Frontier => WeightsOperations.frontierSnapshot(points, directions, epsilon)
/** Builds maximizing directions. @since 0.7.0 @category constructors */
export const maximizeDirections = (objectiveCount: number): Directions =>
  WeightsOperations.maximizeDirections(objectiveCount)
/** Counts coordinate holdings. @since 0.7.0 @category combinators */
export const objectiveFrontierWeights = (
  points: Iterable<Vector>,
  directions: Iterable<Direction> = [],
  epsilon = 0
): HoldingWeights => WeightsOperations.objectiveFrontierWeights(points, directions, epsilon)
/** Computes a reference point. @since 0.7.0 @category hypervolume */
export const referencePoint = (
  points: Iterable<Vector>,
  directions: Iterable<Direction> = []
): Vector => MultiObjective.computeReferencePoint(points, directions)
/** Computes MOTPE candidate weights. @since 0.7.0 @category hypervolume */
export const multiObjectiveWeights = (
  points: Iterable<Vector>,
  reference?: Vector,
  directions: Iterable<Direction> = []
): Weights => MultiObjective.computeMultiObjectiveWeights(points, reference, directions)
/** Computes two-dimensional hypervolume. @since 0.7.0 @category hypervolume */
export const hypervolume2d = (
  points: Iterable<Vector>,
  reference: Vector,
  directions: Iterable<Direction> = []
): number => Hypervolume.hypervolume2d(points, reference, directions)
/** Computes leave-one-out hypervolume contribution. @since 0.7.0 @category hypervolume */
export const hypervolumeContribution2d = (
  points: Iterable<Vector>,
  reference: Vector,
  directions: Iterable<Direction> = []
): Weights => Hypervolume.hypervolumeContribution2d(points, reference, directions)
