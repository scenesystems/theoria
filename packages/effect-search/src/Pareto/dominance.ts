/**
 * Pareto dominance operators.
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
 * Normalize a single objective vector into minimization space.
 *
 * Each coordinate is sanitized through {@link finiteOrInfinity} and then
 * negated when its corresponding direction is `"maximize"`.
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
 * Normalize an entire matrix of objective vectors into minimization space.
 *
 * Applies {@link normalizePoint} to every row so that downstream hot-path
 * functions (e.g. {@link dominatesNormalized}) can skip per-call normalization.
 *
 * @since 0.1.0
 * @category normalization
 */
export const normalizeMatrix = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction>
): ReadonlyArray<ObjectiveVector> => Arr.map(points, (point) => normalizePoint(point, directions))

/**
 * Validate that all vectors in a matrix share the same length.
 *
 * Returns `true` when the array is empty or every vector has the same
 * dimensionality as the first vector.
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
 * Hot-path dominance check on pre-normalized vectors.
 *
 * Assumes both vectors are already in minimization space (via {@link normalizePoint}
 * or {@link normalizeMatrix}). Skips normalization entirely so that callers who
 * pre-normalize a matrix once can amortize the cost across O(n²) comparisons.
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
 * Tests whether `left` Pareto-dominates `right` after objective direction normalization.
 *
 * Dominance requires `left` to be no worse on every objective and strictly better on
 * at least one. When `epsilon` is positive, strict margin mode is used instead: `left`
 * must exceed `right` by at least `epsilon` in every coordinate (no partial improvement
 * required).
 *
 * Returns `false` when `left` and `right` have different lengths — mismatched
 * dimensionality is treated as incomparable rather than as an error.
 *
 * @example
 * ```ts
 * import { Pareto } from "effect-search"
 *
 * Pareto.dominates([0.2, 0.8], [0.3, 0.7], ["minimize", "maximize"])
 * // => true
 * ```
 *
 * @see {@link ObjectiveVector} from `./model` — input vector type
 * @see {@link Direction} from `../contracts/Direction` — per-coordinate optimization sense
 * @see {@link nonDominatedIndices} from `./frontier` — uses this to extract frontier sets
 * @see {@link nonDominatedSort} from `./frontier` — iterative front peeling built on dominance
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
