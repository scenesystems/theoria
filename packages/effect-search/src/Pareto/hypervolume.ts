/**
 * Two-dimensional dominated-area measurement for Pareto fronts.
 *
 * @since 0.1.0
 */

import { Array as Arr, HashSet, Match, Number as Num, Option, Order } from "effect"

import type { Direction } from "../contracts/Direction.js"
import { normalizePoint } from "./dominance.js"
import { nonDominatedIndices } from "./frontier.js"
import type { ObjectiveVector } from "./model.js"

const valueAt = (vector: ObjectiveVector, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))

const pointAt = (points: ReadonlyArray<ObjectiveVector>, index: number): ObjectiveVector =>
  Arr.get(points, index).pipe(Option.getOrElse(() => Arr.empty<number>()))

const computeHypervolume2d = (
  points: ReadonlyArray<ObjectiveVector>,
  reference: ObjectiveVector,
  directions: ReadonlyArray<Direction>
): number => {
  const normalizedReference = normalizePoint(reference, directions)
  const frontIndices = nonDominatedIndices(points, directions)
  const normalizedFront = Arr.sortBy(
    Order.mapInput(Num.Order, (point: ObjectiveVector) => valueAt(point, 0)),
    Order.mapInput(Num.Order, (point: ObjectiveVector) => valueAt(point, 1))
  )(
    Arr.filter(
      Arr.map(frontIndices, (index) => normalizePoint(pointAt(points, index), directions)),
      (point) =>
        valueAt(point, 0) <= valueAt(normalizedReference, 0) && valueAt(point, 1) <= valueAt(normalizedReference, 1)
    )
  )

  const folded = Arr.reduce(
    normalizedFront,
    {
      prevY: valueAt(normalizedReference, 1),
      area: 0
    },
    (state, point) => {
      const width = Num.max(valueAt(normalizedReference, 0) - valueAt(point, 0), 0)
      const height = Num.max(state.prevY - valueAt(point, 1), 0)

      return {
        prevY: Num.min(state.prevY, valueAt(point, 1)),
        area: state.area + width * height
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
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Numeric } from "@scenesystems/effect-math"
 * import { Pareto } from "@scenesystems/effect-search"
 *
 * export const program = Effect.sync(() =>
 *   Pareto.hypervolume2d(
 *     [
 *       [1, 4],
 *       [2, 2],
 *       [3, 1]
 *     ],
 *     [4.4, 4.4]
 *   )
 * ).pipe(
 *   Effect.filterOrFail(
 *     (area) => Numeric.between(Numeric.abs(Numeric.sum([area, -7.56])), { minimum: 0, maximum: 1e-12 }),
 *     () => "UnexpectedHypervolume"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category hypervolume
 */
export const hypervolume2d = (
  points: ReadonlyArray<ObjectiveVector>,
  reference: ObjectiveVector,
  directions: ReadonlyArray<Direction> = []
): number =>
  Match.value(reference.length === 2).pipe(
    Match.when(true, () => computeHypervolume2d(points, reference, directions)),
    Match.when(false, () => 0),
    Match.exhaustive
  )

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
  points: ReadonlyArray<ObjectiveVector>,
  reference: ObjectiveVector,
  directions: ReadonlyArray<Direction> = []
): ReadonlyArray<number> => {
  const front = nonDominatedIndices(points, directions)
  const frontSet = HashSet.fromIterable(front)
  const total = hypervolume2d(points, reference, directions)

  return Arr.map(points, (_point, index) =>
    Match.value(HashSet.has(frontSet, index)).pipe(
      Match.when(true, () => {
        const withoutPoint = Arr.filter(points, (_entry, pointIndex) => pointIndex !== index)
        const contribution = total - hypervolume2d(withoutPoint, reference, directions)

        return Num.max(contribution, 0)
      }),
      Match.when(false, () => 0),
      Match.exhaustive
    ))
}
