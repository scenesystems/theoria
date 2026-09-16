/**
 * Direction-aware comparison of objective vectors.
 *
 * @since 0.1.0
 */

import { Numeric } from "@scenesystems/effect-math"
import { Array as Arr, Boolean, Equal, Match, Number as Num, Option, Schema } from "effect"

import { type Direction, directionOrDefault, type DirectionVector } from "../contracts/Direction.js"
import type { ObjectiveVector, ObjectiveVectorSchema } from "./model.js"

type ObjectiveMatrix = Schema.Array$<typeof ObjectiveVectorSchema>["Type"]

const isNonNaN = Schema.is(Schema.NonNaN)

const lessThanWhenOrdered = (left: number, right: number): boolean =>
  Boolean.match(Boolean.and(isNonNaN(left), isNonNaN(right)), {
    onFalse: () => false,
    onTrue: () => Num.lessThan(left, right)
  })

const lessThanOrEqualToWhenOrdered = (left: number, right: number): boolean =>
  Boolean.match(Boolean.and(isNonNaN(left), isNonNaN(right)), {
    onFalse: () => false,
    onTrue: () => Num.lessThanOrEqualTo(left, right)
  })

const greaterThanOrEqualToWhenOrdered = (left: number, right: number): boolean =>
  Boolean.match(Boolean.and(isNonNaN(left), isNonNaN(right)), {
    onFalse: () => false,
    onTrue: () => Num.greaterThanOrEqualTo(left, right)
  })

const directionAt = (directions: DirectionVector, index: number): Direction =>
  directionOrDefault(Arr.get(directions, index))

const rawValueAt = (vector: ObjectiveVector, index: number): number =>
  Arr.get(vector, index).pipe(Option.getOrElse(() => Number.POSITIVE_INFINITY))

const finiteOrInfinity = (value: number): number =>
  Boolean.match(Numeric.isFinite(value), {
    onFalse: () => Number.POSITIVE_INFINITY,
    onTrue: () => value
  })

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
export const normalizePoint = (point: ObjectiveVector, directions: DirectionVector): ObjectiveVector =>
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
  points: ObjectiveMatrix,
  directions: DirectionVector
): ObjectiveMatrix => Arr.map(points, (point) => normalizePoint(point, directions))

/**
 * Reports whether every row has the first row's arity. An empty matrix is rectangular.
 *
 * @since 0.1.0
 * @category validation
 */
export const validateRectangular = (points: ObjectiveMatrix): boolean =>
  Arr.match(points, {
    onEmpty: () => true,
    onNonEmpty: (nonEmpty) => {
      const expectedLength = Arr.length(Arr.headNonEmpty(nonEmpty))
      return Arr.every(nonEmpty, (point) => Equal.equals(Arr.length(point), expectedLength))
    }
  })

const normalizedEpsilon = (epsilon: number): number =>
  Boolean.match(Boolean.and(Numeric.isFinite(epsilon), Num.greaterThan(epsilon, 0)), {
    onFalse: () => 0,
    onTrue: () => epsilon
  })

const dominatesExactly = (
  normalizedLeft: ObjectiveVector,
  normalizedRight: ObjectiveVector
): boolean => {
  const noWorse = Arr.every(
    normalizedLeft,
    (value, index) => lessThanOrEqualToWhenOrdered(value, rawValueAt(normalizedRight, index))
  )
  const strictlyBetter = Arr.some(
    normalizedLeft,
    (value, index) => lessThanWhenOrdered(value, rawValueAt(normalizedRight, index))
  )

  return Boolean.and(noWorse, strictlyBetter)
}

const dominatesWithEpsilon = (
  normalizedLeft: ObjectiveVector,
  normalizedRight: ObjectiveVector,
  epsilon: number
): boolean =>
  Arr.every(
    normalizedLeft,
    (value, index) => greaterThanOrEqualToWhenOrdered(Num.subtract(rawValueAt(normalizedRight, index), value), epsilon)
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
  Boolean.match(Equal.equals(Arr.length(normalizedLeft), Arr.length(normalizedRight)), {
    onFalse: () => false,
    onTrue: () => {
      const margin = normalizedEpsilon(epsilon)

      return Boolean.match(Num.lessThanOrEqualTo(margin, 0), {
        onFalse: () => dominatesWithEpsilon(normalizedLeft, normalizedRight, margin),
        onTrue: () => dominatesExactly(normalizedLeft, normalizedRight)
      })
    }
  })

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
 * import { Array as Arr, Effect } from "effect"
 * import { Pareto } from "@scenesystems/effect-search"
 * import type { Direction } from "@scenesystems/effect-search/contracts"
 *
 * export const program = Effect.sync(() =>
 *   Pareto.dominates(
 *     Arr.make(0.2, 0.8),
 *     Arr.make(0.3, 0.7),
 *     Arr.make<Arr.NonEmptyArray<Direction>>("minimize", "maximize")
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
  directions: DirectionVector = Arr.empty(),
  epsilon = 0
): boolean => {
  const normalizedLeft = normalizePoint(left, directions)
  const normalizedRight = normalizePoint(right, directions)

  return dominatesNormalized(normalizedLeft, normalizedRight, epsilon)
}
