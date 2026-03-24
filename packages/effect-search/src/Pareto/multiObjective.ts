/**
 * Hypervolume-derived reference points and objective weights for MOTPE-style ranking.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Option, Schema } from "effect"

import type { Direction } from "../contracts/Direction.js"
import { hypervolumeContribution2d } from "./hypervolume.js"
import type { ObjectiveVector } from "./model.js"

/**
 * Schema for a per-candidate weight vector produced by hypervolume-based ranking.
 *
 * Each element is a normalized weight in `(0, 1]` indicating the candidate's relative
 * hypervolume contribution. Used as importance weights in MOTPE-style samplers.
 *
 * @see {@link ObjectiveWeights} Extracted type alias
 * @see {@link computeMultiObjectiveWeights} Produces values conforming to this schema
 *
 * @since 0.1.0
 * @category models
 */
export const ObjectiveWeightsSchema = Schema.Array(Schema.Number)

/**
 * Per-candidate weight vector from hypervolume-based ranking.
 *
 * Values are normalized to `(0, 1]` with a floor of `EPS` (1e-12) to avoid
 * zero-weight candidates being entirely excluded from sampling.
 *
 * @see {@link ObjectiveWeightsSchema} Schema that produces this type
 * @see {@link computeMultiObjectiveWeights} Primary producer of these weights
 *
 * @since 0.1.0
 * @category models
 */
export type ObjectiveWeights = Schema.Schema.Type<typeof ObjectiveWeightsSchema>

const EPS = 1e-12

const directionAt = (directions: ReadonlyArray<Direction>, index: number): Direction =>
  Arr.get(directions, index).pipe(
    Option.match({
      onNone: () => "minimize",
      onSome: (direction) => direction
    })
  )

const valueAt = (vector: ObjectiveVector, index: number): number =>
  Arr.get(vector, index).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (value) => value
    })
  )

const toLossCoordinate = (value: number, direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => -value),
    Match.orElse(() => value)
  )

const fromLossCoordinate = (value: number, direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => -value),
    Match.orElse(() => value)
  )

const toLossSpace = (
  point: ObjectiveVector,
  directions: ReadonlyArray<Direction>
): ObjectiveVector => Arr.map(point, (value, index) => toLossCoordinate(value, directionAt(directions, index)))

const fromLossSpace = (
  point: ObjectiveVector,
  directions: ReadonlyArray<Direction>
): ObjectiveVector => Arr.map(point, (value, index) => fromLossCoordinate(value, directionAt(directions, index)))

const dimensionLength = (points: ReadonlyArray<ObjectiveVector>): number =>
  Arr.head(points).pipe(
    Option.match({
      onNone: () => 0,
      onSome: (point) => point.length
    })
  )

const referenceFromLossPoints = (points: ReadonlyArray<ObjectiveVector>): ObjectiveVector => {
  const dimensions = dimensionLength(points)

  return Arr.makeBy(dimensions, (dimension) => {
    const worst = Arr.reduce(
      points,
      Number.NEGATIVE_INFINITY,
      (acc, point) => Num.max(acc, valueAt(point, dimension))
    )
    const reference = Num.max(1.1 * worst, 0.9 * worst)

    return Match.value(reference === 0).pipe(
      Match.when(true, () => EPS),
      Match.orElse(() => reference)
    )
  })
}

const normalizeContributions = (contributions: ReadonlyArray<number>): ObjectiveWeights => {
  const maxContribution = Arr.reduce(contributions, 0, (acc, value) => Num.max(acc, value))
  const normalizer = Num.max(maxContribution, EPS)

  return Arr.map(contributions, (value) => Num.max(Num.unsafeDivide(value, normalizer), EPS))
}

/**
 * Compute a direction-aware reference point for hypervolume calculation.
 *
 * Projects all points into loss space (minimization), takes the worst value per
 * coordinate with a 10% margin, then projects back. The margin ensures the reference
 * strictly dominates all observed points. Returns an empty array when `points` is empty.
 *
 * @see {@link computeMultiObjectiveWeights} Uses this as the default reference when none is supplied
 * @see {@link hypervolume2d} from `./hypervolume` — consumes the reference point
 *
 * @since 0.1.0
 * @category hypervolume
 */
export const computeReferencePoint = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = []
): ObjectiveVector =>
  Match.value(points.length <= 0).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => {
      const lossPoints = Arr.map(points, (point) => toLossSpace(point, directions))

      return fromLossSpace(referenceFromLossPoints(lossPoints), directions)
    })
  )

/**
 * Compute normalized MOTPE-style objective weights from hypervolume contributions.
 *
 * Normalizes leave-one-out hypervolume contributions to `(0, 1]` so the highest
 * contributor receives weight `1` and all others are proportionally scaled. A floor
 * of `EPS` (1e-12) prevents any candidate from receiving zero weight.
 *
 * Falls back to uniform weights (`1` for every candidate) when the reference point
 * does not have exactly 2 coordinates, since the underlying hypervolume indicator
 * only supports 2D.
 *
 * @see {@link computeReferencePoint} Auto-derives a reference when `referencePoint` is omitted
 * @see {@link hypervolumeContribution2d} from `./hypervolume` — raw contributions before normalization
 * @see {@link ObjectiveWeights} Return type
 *
 * @since 0.1.0
 * @category hypervolume
 */
export const computeMultiObjectiveWeights = (
  points: ReadonlyArray<ObjectiveVector>,
  referencePoint?: ObjectiveVector,
  directions: ReadonlyArray<Direction> = []
): ObjectiveWeights =>
  Match.value(points.length <= 0).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => {
      const lossPoints = Arr.map(points, (point) => toLossSpace(point, directions))
      const lossReference = Option.fromNullable(referencePoint).pipe(
        Option.match({
          onNone: () => referenceFromLossPoints(lossPoints),
          onSome: (point) => toLossSpace(point, directions)
        })
      )

      return Match.value(lossReference.length === 2).pipe(
        Match.when(true, () => normalizeContributions(hypervolumeContribution2d(lossPoints, lossReference))),
        Match.orElse(() => Arr.map(points, () => 1))
      )
    })
  )
