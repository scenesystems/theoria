/**
 * Reference-point construction and two-dimensional hypervolume weights for MOTPE.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Option, Schema } from "effect"

import type { Direction } from "../contracts/Direction.js"
import { hypervolumeContribution2d } from "./hypervolume.js"
import type { ObjectiveVector } from "./model.js"

/**
 * Decodes candidate weights without imposing positivity, normalization, or finiteness.
 *
 * @since 0.1.0
 * @category models
 */
export const ObjectiveWeightsSchema = Schema.Array(Schema.Number)

/**
 * Candidate weights returned in the same order as the supplied objective vectors.
 *
 * @remarks
 * {@link computeMultiObjectiveWeights} produces values from `1e-12` through one for
 * its two-dimensional path, but the schema and type do not enforce that range.
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
 * Derives the reference coordinate beyond the worst observed value in each objective.
 *
 * @remarks
 * Coordinates are converted to minimization values before applying
 * `max(1.1 * worst, 0.9 * worst)`, then converted back. A zero result becomes `1e-12`.
 * The first point determines arity; missing coordinates in later points contribute zero.
 * Missing directions default to `"minimize"`, and empty input returns an empty array.
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
 * Converts leave-one-out hypervolume contributions into MOTPE candidate weights.
 *
 * @remarks
 * For a two-coordinate reference, the largest contribution receives one and other
 * contributions are divided by it, with `1e-12` as the minimum weight. A reference
 * with any other arity returns one for every candidate. Omission derives the reference
 * from the points. Empty input returns an empty array.
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
