/**
 * Pareto hypervolume operators.
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
 * Computes the 2D hypervolume indicator (area dominated by the non-dominated front)
 * relative to a reference point, after direction normalization.
 *
 * Internally extracts the non-dominated front, normalizes all coordinates to
 * minimization space, clips points outside the reference bounds, then sweeps
 * left-to-right accumulating staircase area. Returns `0` when the reference
 * point does not have exactly two coordinates.
 *
 * @example
 * ```ts
 * import { Pareto } from "effect-search"
 *
 * Pareto.hypervolume2d(
 *   [
 *     [1, 4],
 *     [2, 2],
 *     [3, 1]
 *   ],
 *   [4.4, 4.4]
 * )
 * // => 7.56
 * ```
 *
 * @see {@link hypervolumeContribution2d} Leave-one-out marginal contributions
 * @see {@link nonDominatedIndices} from `./frontier` — front extraction used internally
 * @see {@link ObjectiveVector} from `./model` — input vector type
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
 * Computes leave-one-out 2D hypervolume contributions for each candidate.
 *
 * For each non-dominated point, the contribution is the decrease in total hypervolume
 * when that point is removed. Dominated points contribute `0` by definition since
 * removing them does not change the frontier area. Useful for crowding-distance-style
 * selection in MOTPE and NSGA-II variants.
 *
 * @see {@link hypervolume2d} Total hypervolume used as the baseline
 * @see {@link nonDominatedIndices} from `./frontier` — determines which points are on the front
 * @see {@link computeMultiObjectiveWeights} from `./multiObjective` — consumes these contributions
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
