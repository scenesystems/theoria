/**
 * Direction-aware comparison of objective vectors.
 *
 * @since 0.1.0
 */

import { Array as Arr, Equal, Match, Number as Num, Option } from "effect"

import type { Direction } from "../contracts/Direction.js"
import type { ObjectiveVector } from "./model.js"

const defaultDirection = (): Direction => "minimize"

const directionAt = (directions: ReadonlyArray<Direction>, index: number): Direction =>
  Arr.get(directions, index).pipe(Option.getOrElse(defaultDirection))

const rawValueAt = (vector: ObjectiveVector, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))

const finiteOrInfinity = (value: number): number =>
  Match.value(Number.isFinite(value)).pipe(
    Match.when(true, () => value),
    Match.when(false, () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

const normalizeCoordinate = (value: number, direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => -value),
    Match.when("minimize", () => value),
    Match.exhaustive
  )

/**
 * Converts objective coordinates to minimization values for internal comparison.
 * Missing directions default to `"minimize"`. Non-finite coordinates become
 * positive infinity before maximize coordinates are negated.
 *
 * @since 0.1.0
 * @category normalization
 */
export const normalizePoint = (point: ObjectiveVector, directions: ReadonlyArray<Direction>): ObjectiveVector =>
  Arr.map(point, (value, index) =>
    normalizeCoordinate(
      finiteOrInfinity(value),
      directionAt(directions, index)
    ))

/**
 * Converts every row to the minimization representation used by Pareto comparison.
 *
 * @since 0.1.0
 * @category normalization
 */
export const normalizeMatrix = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction>
): ReadonlyArray<ObjectiveVector> => Arr.map(points, (point) => normalizePoint(point, directions))

/**
 * Reports whether every row has the first row's arity. An empty matrix is rectangular.
 *
 * @since 0.1.0
 * @category validation
 */
export const validateRectangular = (points: ReadonlyArray<ObjectiveVector>): boolean =>
  Arr.match(points, {
    onEmpty: () => true,
    onNonEmpty: (nonEmpty) => {
      const expectedLength = Arr.headNonEmpty(nonEmpty).length
      return Arr.every(nonEmpty, (point) => Equal.equals(point.length, expectedLength))
    }
  })

const normalizedEpsilon = (epsilon: number): number =>
  Match.value(Number.isFinite(epsilon) && Num.greaterThan(epsilon, 0)).pipe(
    Match.when(true, () => epsilon),
    Match.orElse(() => 0)
  )

const dominatesExactly = (
  normalizedLeft: ObjectiveVector,
  normalizedRight: ObjectiveVector
): boolean => {
  const noWorse = Arr.every(
    normalizedLeft,
    (value, index) => value <= rawValueAt(normalizedRight, index)
  )
  const strictlyBetter = Arr.some(normalizedLeft, (value, index) => value < rawValueAt(normalizedRight, index))

  return noWorse && strictlyBetter
}

const dominatesWithEpsilon = (
  normalizedLeft: ObjectiveVector,
  normalizedRight: ObjectiveVector,
  epsilon: number
): boolean =>
  Arr.every(
    normalizedLeft,
    (value, index) => Num.greaterThanOrEqualTo(rawValueAt(normalizedRight, index) - value, epsilon)
  )

/**
 * Compares equal-length vectors that are already expressed as minimization values.
 *
 * A finite positive `epsilon` requires the left coordinate to improve on every
 * right coordinate by at least that margin. Other epsilon values use ordinary
 * Pareto dominance. Different vector lengths return `false`.
 *
 * @since 0.1.0
 * @category dominance
 */
export const dominatesNormalized = (
  normalizedLeft: ObjectiveVector,
  normalizedRight: ObjectiveVector,
  epsilon = 0
): boolean =>
  Match.value(Equal.equals(normalizedLeft.length, normalizedRight.length)).pipe(
    Match.when(true, () => {
      const margin = normalizedEpsilon(epsilon)

      return Match.value(Num.lessThanOrEqualTo(margin, 0)).pipe(
        Match.when(true, () => dominatesExactly(normalizedLeft, normalizedRight)),
        Match.orElse(() => dominatesWithEpsilon(normalizedLeft, normalizedRight, margin))
      )
    }),
    Match.when(false, () => false),
    Match.exhaustive
  )

/**
 * Reports whether `left` Pareto-dominates `right` under the supplied directions.
 *
 * @remarks
 * Ordinary dominance requires the left candidate to be no worse on every coordinate
 * and better on at least one. A finite positive `epsilon` instead requires an
 * improvement of at least that amount on every coordinate. Missing directions default
 * to `"minimize"`; excess directions are ignored. Different vector lengths return
 * `false`.
 *
 * Non-finite coordinates are converted to positive infinity before direction
 * normalization. Callers that use maximize directions should reject non-finite
 * objective values before comparison because negating that sentinel produces
 * negative infinity.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Pareto } from "@scenesystems/effect-search"
 *
 * export const program = Effect.sync(() =>
 *   Pareto.dominates(
 *     [0.2, 0.8],
 *     [0.3, 0.7],
 *     ["minimize", "maximize"]
 *   )
 * ).pipe(
 *   Effect.filterOrFail(
 *     (preferred) => preferred,
 *     () => "ExpectedDominance"
 *   )
 * )
 * ```
 *
 * @since 0.1.0
 * @category dominance
 */
export const dominates = (
  left: ObjectiveVector,
  right: ObjectiveVector,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): boolean => {
  const normalizedLeft = normalizePoint(left, directions)
  const normalizedRight = normalizePoint(right, directions)

  return dominatesNormalized(normalizedLeft, normalizedRight, epsilon)
}
