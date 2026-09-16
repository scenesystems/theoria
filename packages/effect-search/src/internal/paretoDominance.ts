/**
 * Direction-aware comparison of objective vectors.
 *
 * @since 0.1.0
 */

import { isFinite } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Equal, Match, Number as Num, Option } from "effect"

import type { Direction } from "../Direction.js"
import type { Vector } from "../Objective.js"

const minimize = (): Direction => "minimize"

const directionAt = (directionsInput: Iterable<Direction>, index: number): Direction => {
  const directions = Arr.fromIterable(directionsInput)
  return Arr.get(directions, index).pipe(Option.getOrElse(minimize))
}

const rawValueAt = (vector: Vector, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))

const finiteOrInfinity = (value: number): number =>
  Match.value(isFinite(value)).pipe(
    Match.when(true, () => value),
    Match.when(false, () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

const normalizeCoordinate = (value: number, direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => Num.negate(value)),
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
export const normalizePoint = (point: Vector, directionsInput: Iterable<Direction>): Vector => {
  const directions = Arr.fromIterable(directionsInput)
  return Arr.map(point, (value, index) =>
    normalizeCoordinate(
      finiteOrInfinity(value),
      directionAt(directions, index)
    ))
}

/**
 * Converts every row to the minimization representation used by Pareto comparison.
 *
 * @since 0.1.0
 * @category normalization
 */
export const normalizeMatrix = (
  pointsInput: Iterable<Vector>,
  directionsInput: Iterable<Direction>
) => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)
  return Arr.map(points, (point) => normalizePoint(point, directions))
}

/**
 * Reports whether every row has the first row's arity. An empty matrix is rectangular.
 *
 * @since 0.1.0
 * @category validation
 */
export const validateRectangular = (pointsInput: Iterable<Vector>): boolean => {
  const points = Arr.fromIterable(pointsInput)
  return Arr.match(points, {
    onEmpty: () => true,
    onNonEmpty: (nonEmpty) => {
      const expectedLength = Arr.length(Arr.headNonEmpty(nonEmpty))
      return Arr.every(nonEmpty, (point) => Equal.equals(Arr.length(point), expectedLength))
    }
  })
}

const normalizedEpsilon = (epsilon: number): number =>
  Match.value(Bool.and(isFinite(epsilon), Num.greaterThan(epsilon, 0))).pipe(
    Match.when(true, () => epsilon),
    Match.orElse(() => 0)
  )

const dominatesExactly = (
  normalizedLeft: Vector,
  normalizedRight: Vector
): boolean => {
  const noWorse = Arr.every(
    normalizedLeft,
    (value, index) => Num.lessThanOrEqualTo(value, rawValueAt(normalizedRight, index))
  )
  const strictlyBetter = Arr.some(
    normalizedLeft,
    (value, index) => Num.lessThan(value, rawValueAt(normalizedRight, index))
  )

  return Bool.and(noWorse, strictlyBetter)
}

const dominatesWithEpsilon = (
  normalizedLeft: Vector,
  normalizedRight: Vector,
  epsilon: number
): boolean =>
  Arr.every(
    normalizedLeft,
    (value, index) => Num.greaterThanOrEqualTo(Num.subtract(rawValueAt(normalizedRight, index), value), epsilon)
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
  normalizedLeft: Vector,
  normalizedRight: Vector,
  epsilon = 0
): boolean =>
  Match.value(Equal.equals(Arr.length(normalizedLeft), Arr.length(normalizedRight))).pipe(
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
 * @since 0.1.0
 * @category dominance
 */
export const dominates = (
  left: Vector,
  right: Vector,
  directionsInput: Iterable<Direction> = Arr.empty(),
  epsilon = 0
): boolean => {
  const directions = Arr.fromIterable(directionsInput)

  const normalizedLeft = normalizePoint(left, directions)
  const normalizedRight = normalizePoint(right, directions)

  return dominatesNormalized(normalizedLeft, normalizedRight, epsilon)
}
