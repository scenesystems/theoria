/**
 * Two-dimensional dominated-area measurement for Pareto fronts.
 *
 * @since 0.1.0
 */

import { Array as Arr, Boolean, HashSet, Number as Num, Option, Order, Tuple } from "effect"
import type { Schema } from "effect"

import type { DirectionVector } from "../contracts/Direction.js"
import { normalizePoint } from "./dominance.js"
import { nonDominatedIndices } from "./frontier.js"
import type { ObjectiveVector, ObjectiveVectorSchema } from "./model.js"

type NumberArray = Schema.Array$<typeof Schema.Number>["Type"]
type ObjectiveMatrix = Schema.Array$<typeof ObjectiveVectorSchema>["Type"]

const valueAt = (vector: ObjectiveVector, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))

const pointAt = (points: ObjectiveMatrix, index: number): ObjectiveVector =>
  Arr.get(points, index).pipe(Option.getOrElse(() => Arr.empty<number>()))

const computeHypervolume2d = (
  points: ObjectiveMatrix,
  reference: ObjectiveVector,
  directions: DirectionVector
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
        Boolean.and(
          Num.lessThanOrEqualTo(valueAt(point, 0), valueAt(normalizedReference, 0)),
          Num.lessThanOrEqualTo(valueAt(point, 1), valueAt(normalizedReference, 1))
        )
    )
  )

  const folded = Arr.reduce(
    normalizedFront,
    Tuple.make(valueAt(normalizedReference, 1), 0),
    (state, point) => {
      const width = Num.max(Num.subtract(valueAt(normalizedReference, 0), valueAt(point, 0)), 0)
      const height = Num.max(Num.subtract(Tuple.getFirst(state), valueAt(point, 1)), 0)

      return Tuple.make(
        Num.min(Tuple.getFirst(state), valueAt(point, 1)),
        Num.sum(Tuple.getSecond(state), Num.multiply(width, height))
      )
    }
  )

  return Tuple.getSecond(folded)
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
 * import { Array as Arr, Effect, Number as Num } from "effect"
 * import { Numeric } from "@scenesystems/effect-math"
 * import { Pareto } from "@scenesystems/effect-search"
 *
 * export const program = Effect.sync(() =>
 *   Pareto.hypervolume2d(
 *     Arr.make(Arr.make(1, 4), Arr.make(2, 2), Arr.make(3, 1)),
 *     Arr.make(4.4, 4.4)
 *   )
 * ).pipe(
 *   Effect.filterOrFail(
 *     (area) => Numeric.between(Numeric.abs(Num.subtract(area, 7.56)), { minimum: 0, maximum: 1e-12 }),
 *     () => "UnexpectedHypervolume"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category hypervolume
 */
export const hypervolume2d = (
  points: ObjectiveMatrix,
  reference: ObjectiveVector,
  directions: DirectionVector = Arr.empty()
): number =>
  Boolean.match(Num.Equivalence(Arr.length(reference), 2), {
    onFalse: () => 0,
    onTrue: () => computeHypervolume2d(points, reference, directions)
  })

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
  points: ObjectiveMatrix,
  reference: ObjectiveVector,
  directions: DirectionVector = Arr.empty()
): NumberArray => {
  const front = nonDominatedIndices(points, directions)
  const frontSet = HashSet.fromIterable(front)
  const total = hypervolume2d(points, reference, directions)

  return Arr.map(points, (_point, index) =>
    Boolean.match(HashSet.has(frontSet, index), {
      onFalse: () => 0,
      onTrue: () => {
        const withoutPoint = Arr.filter(points, (_entry, pointIndex) => Boolean.not(Num.Equivalence(pointIndex, index)))
        const contribution = Num.subtract(total, hypervolume2d(withoutPoint, reference, directions))

        return Num.max(contribution, 0)
      }
    }))
}
