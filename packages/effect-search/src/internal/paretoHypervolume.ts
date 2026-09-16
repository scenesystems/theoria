/**
 * Two-dimensional dominated-area measurement for Pareto fronts.
 *
 * @since 0.1.0
 */

import { Array as Arr, Boolean as Bool, Equal, HashSet, Match, Number as Num, Option, Order } from "effect"

import type { Direction } from "../Direction.js"
import type { Vector } from "../Objective.js"
import { normalizePoint } from "./paretoDominance.js"
import { nonDominatedIndices } from "./paretoFrontier.js"

const valueAt = (vector: Vector, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))

const pointAt = (pointsInput: Iterable<Vector>, index: number): Vector => {
  const points = Arr.fromIterable(pointsInput)
  return Arr.get(points, index).pipe(Option.getOrElse(() => Arr.empty<number>()))
}

const computeHypervolume2d = (
  pointsInput: Iterable<Vector>,
  reference: Vector,
  directionsInput: Iterable<Direction>
): number => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)

  const normalizedReference = normalizePoint(reference, directions)
  const frontIndices = nonDominatedIndices(points, directions)
  const normalizedFront = Arr.sortBy(
    Order.mapInput(Num.Order, (point: Vector) => valueAt(point, 0)),
    Order.mapInput(Num.Order, (point: Vector) => valueAt(point, 1))
  )(
    Arr.filter(
      Arr.map(frontIndices, (index) => normalizePoint(pointAt(points, index), directions)),
      (point) =>
        Bool.and(
          Num.lessThanOrEqualTo(valueAt(point, 0), valueAt(normalizedReference, 0)),
          Num.lessThanOrEqualTo(valueAt(point, 1), valueAt(normalizedReference, 1))
        )
    )
  )

  const folded = Arr.reduce(
    normalizedFront,
    {
      prevY: valueAt(normalizedReference, 1),
      area: 0
    },
    (state, point) => {
      const width = Num.max(Num.subtract(valueAt(normalizedReference, 0), valueAt(point, 0)), 0)
      const height = Num.max(Num.subtract(state.prevY, valueAt(point, 1)), 0)

      return {
        prevY: Num.min(state.prevY, valueAt(point, 1)),
        area: Num.sum(state.area, Num.multiply(width, height))
      }
    }
  )

  return folded.area
}

/**
 * Measures the area between a two-dimensional Pareto front and a reference point.
 *
 * @remarks
 * Points outside either reference bound do not contribute. Directions omitted by
 * the caller default to `"minimize"`. A reference with any arity other than two,
 * an empty point set, or a ragged point matrix returns zero.
 *
 * @since 0.1.0
 * @category hypervolume
 */
export const hypervolume2d = (
  pointsInput: Iterable<Vector>,
  reference: Vector,
  directionsInput: Iterable<Direction> = Arr.empty()
): number => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)
  return Match.value(Equal.equals(Arr.length(reference), 2)).pipe(
    Match.when(true, () => computeHypervolume2d(points, reference, directions)),
    Match.when(false, () => 0),
    Match.exhaustive
  )
}

/**
 * Measures each candidate's decrease in hypervolume when removed from the input.
 *
 * @remarks
 * Results preserve candidate order. Dominated candidates receive zero. Contributions
 * are clamped at zero to absorb negative floating-point error. An invalid reference
 * arity or ragged matrix therefore produces zero for every candidate.
 *
 * @since 0.1.0
 * @category hypervolume
 */
export const hypervolumeContribution2d = (
  pointsInput: Iterable<Vector>,
  reference: Vector,
  directionsInput: Iterable<Direction> = Arr.empty()
) => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)

  const front = nonDominatedIndices(points, directions)
  const frontSet = HashSet.fromIterable(front)
  const total = hypervolume2d(points, reference, directions)

  return Arr.map(points, (_point, index) =>
    Match.value(HashSet.has(frontSet, index)).pipe(
      Match.when(true, () => {
        const withoutPoint = Arr.filter(points, (_entry, pointIndex) => Bool.not(Equal.equals(pointIndex, index)))
        const contribution = Num.subtract(total, hypervolume2d(withoutPoint, reference, directions))

        return Num.max(contribution, 0)
      }),
      Match.when(false, () => 0),
      Match.exhaustive
    ))
}
