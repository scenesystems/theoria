/**
 * Stable extraction and ranking of non-dominated candidates.
 *
 * @since 0.1.0
 */

import { abs } from "@scenesystems/effect-math/Numeric"
import { Array as Arr, Boolean as Bool, Equal, HashSet, Match, Number as Num, Option, Schema } from "effect"

import type { Direction } from "../Direction.js"
import type { Vector } from "../Objective.js"
import { Holding } from "../Pareto.js"
import { dominatesNormalized, normalizeMatrix, validateRectangular } from "./paretoDominance.js"

const Fronts = Schema.Array(Schema.Array(Schema.Number))
type Fronts = typeof Fronts.Type

const isNonNaN = Schema.is(Schema.NonNaN)

const buildIndices = (count: number) =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.range(0, Num.decrement(count)))
  )

const minimize = (): Direction => "minimize"

const directionAt = (directionsInput: Iterable<Direction>, index: number): Direction => {
  const directions = Arr.fromIterable(directionsInput)
  return Arr.get(directions, index).pipe(Option.getOrElse(minimize))
}

const defaultCoordinateValue = (direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => Number.NEGATIVE_INFINITY),
    Match.when("minimize", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

const coordinateAt = (point: Vector, index: number, direction: Direction): number =>
  Arr.get(point, index).pipe(Option.getOrElse(() => defaultCoordinateValue(direction)))

const pointAt = (pointsInput: Iterable<Vector>, index: number): Vector => {
  const points = Arr.fromIterable(pointsInput)
  return Arr.get(points, index).pipe(Option.getOrElse(() => Arr.empty<number>()))
}

const objectiveDimensionCount = (pointsInput: Iterable<Vector>): number => {
  const points = Arr.fromIterable(pointsInput)
  return Arr.head(points).pipe(Option.match({ onNone: () => 0, onSome: Arr.length }))
}

const normalizedAt = (normalizedInput: Iterable<Vector>, index: number): Vector => {
  const normalized = Arr.fromIterable(normalizedInput)
  return Arr.get(normalized, index).pipe(Option.getOrElse(() => Arr.empty<number>()))
}

const isBetter = (a: number, b: number, d: Direction): boolean =>
  Bool.and(
    Bool.and(isNonNaN(a), isNonNaN(b)),
    Match.value(d).pipe(
      Match.when("maximize", () => Num.greaterThan(a, b)),
      Match.when("minimize", () => Num.lessThan(a, b)),
      Match.exhaustive
    )
  )

/**
 * Selects the input indices that no other candidate dominates.
 *
 * @remarks
 * Indices preserve input order, and equal candidates remain on the same front. A
 * ragged matrix returns an empty array. Missing directions default to `"minimize"`.
 * A finite positive `epsilon` requires a candidate to improve every coordinate by
 * at least that margin before it dominates another candidate.
 *
 * @since 0.1.0
 * @category frontier
 */
export const nonDominatedIndices = (
  pointsInput: Iterable<Vector>,
  directionsInput: Iterable<Direction> = Arr.empty(),
  epsilon = 0
) => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)
  return Match.value(validateRectangular(points)).pipe(
    Match.when(false, () => Arr.empty<number>()),
    Match.when(true, () => {
      const normalized = normalizeMatrix(points, directions)
      return Arr.filter(buildIndices(Arr.length(points)), (index) =>
        Arr.every(normalized, (candidate, ci) =>
          Bool.or(
            Equal.equals(ci, index),
            Bool.not(dominatesNormalized(candidate, normalizedAt(normalized, index), epsilon))
          )))
    }),
    Match.exhaustive
  )
}

/**
 * Partitions candidates into successive non-dominated fronts in input order.
 *
 * @remarks
 * The first array is the Pareto front. Removing it exposes the next front, and the
 * process continues until every candidate is assigned. Empty and ragged matrices
 * return an empty array.
 *
 * @since 0.1.0
 * @category frontier
 */
export const nonDominatedSort = (
  pointsInput: Iterable<Vector>,
  directionsInput: Iterable<Direction> = Arr.empty(),
  epsilon = 0
) => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)
  return Match.value(validateRectangular(points)).pipe(
    Match.when(false, () => Arr.empty<Vector>()),
    Match.when(true, () => {
      const n = Arr.length(points)
      const indices = buildIndices(n)
      const normalized = normalizeMatrix(points, directions)

      const zeroCounts = Arr.replicate(0, n)
      const emptyDominated = Arr.replicate(Arr.empty<number>(), n)

      const initial = Arr.reduce(indices, {
        counts: zeroCounts,
        dominated: emptyDominated
      }, (state, i) =>
        Arr.reduce(indices, state, (acc, j) =>
          Match.value(Equal.equals(i, j)).pipe(
            Match.when(true, () => acc),
            Match.orElse(() =>
              Match.value(dominatesNormalized(normalizedAt(normalized, i), normalizedAt(normalized, j), epsilon)).pipe(
                Match.when(true, () => ({
                  counts: Arr.modify(acc.counts, j, Num.increment),
                  dominated: Arr.modify(acc.dominated, i, (dominated) => Arr.append(dominated, j))
                })),
                Match.orElse(() => acc)
              )
            )
          )))

      const peel = (
        countsInput: Iterable<number>,
        remaining: HashSet.HashSet<number>,
        frontsInput: Iterable<Vector>
      ): Fronts => {
        const counts = Arr.fromIterable(countsInput)
        const fronts = Arr.fromIterable(frontsInput)
        return Match.value(Num.lessThanOrEqualTo(HashSet.size(remaining), 0)).pipe(
          Match.when(true, () => fronts),
          Match.orElse(() => {
            const front = Arr.filter(
              indices,
              (i) =>
                Bool.and(
                  HashSet.has(remaining, i),
                  Equal.equals(Arr.get(counts, i).pipe(Option.getOrElse(() => 0)), 0)
                )
            )

            return Match.value(Arr.isEmptyReadonlyArray(front)).pipe(
              Match.when(true, () => fronts),
              Match.orElse(() => {
                const nextRemaining = HashSet.difference(remaining, HashSet.fromIterable(front))
                const nextCounts = Arr.reduce(front, counts, (cs, i) =>
                  Arr.reduce(
                    Arr.get(initial.dominated, i).pipe(Option.getOrElse(() => Arr.empty<number>())),
                    cs,
                    (inner, j) => Arr.modify(inner, j, Num.decrement)
                  ))

                return peel(nextCounts, nextRemaining, Arr.append(fronts, front))
              })
            )
          })
        )
      }

      return peel(initial.counts, HashSet.fromIterable(indices), Arr.empty<Vector>())
    }),
    Match.exhaustive
  )
}

/**
 * Assigns each candidate its zero-based position in successive non-dominated fronts.
 *
 * @remarks
 * Rank zero identifies the Pareto front. Every candidate in a ragged matrix receives
 * positive infinity because the matrix cannot be sorted.
 *
 * @since 0.1.0
 * @category frontier
 */
export const nonDominatedRanks = (
  pointsInput: Iterable<Vector>,
  directionsInput: Iterable<Direction> = Arr.empty(),
  epsilon = 0
) => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)

  const fronts = nonDominatedSort(points, directions, epsilon)
  const indexSets = Arr.map(fronts, (front) => HashSet.fromIterable(front))

  return Arr.map(
    points,
    (_point, index) =>
      Arr.findFirstIndex(indexSets, (frontSet) => HashSet.has(frontSet, index)).pipe(
        Option.match({ onNone: () => Number.POSITIVE_INFINITY, onSome: (rank) => rank })
      )
  )
}

/**
 * Finds the best value and all exact holders independently for each objective coordinate.
 *
 * @remarks
 * The first row determines the number of coordinates. Missing directions default to
 * `"minimize"`. Empty and ragged matrices return no holdings. Holder membership uses
 * exact numeric equality; the current `epsilon` argument does not admit near-equal values.
 *
 * @since 0.1.0
 * @category frontier
 */
export const objectiveFrontierHoldings = (
  pointsInput: Iterable<Vector>,
  directionsInput: Iterable<Direction> = Arr.empty(),
  epsilon = 0
) => {
  const points = Arr.fromIterable(pointsInput)
  const directions = Arr.fromIterable(directionsInput)
  return Match.value(validateRectangular(points)).pipe(
    Match.when(false, () => Arr.empty<Holding>()),
    Match.when(true, () =>
      Arr.map(buildIndices(objectiveDimensionCount(points)), (objectiveIndex) => {
        const direction = directionAt(directions, objectiveIndex)
        const allIndices = buildIndices(Arr.length(points))

        const bestValue = Arr.reduce(allIndices, defaultCoordinateValue(direction), (best, ci) => {
          const v = coordinateAt(pointAt(points, ci), objectiveIndex, direction)
          return Match.value(isBetter(v, best, direction)).pipe(
            Match.when(true, () => v),
            Match.orElse(() => best)
          )
        })

        const holders = Arr.filter(allIndices, (ci) => {
          const v = coordinateAt(pointAt(points, ci), objectiveIndex, direction)
          return Match.value(Num.greaterThan(epsilon, 0)).pipe(
            Match.when(true, () =>
              Bool.and(
                Num.lessThanOrEqualTo(abs(Num.subtract(v, bestValue)), epsilon),
                Bool.or(Equal.equals(v, bestValue), isBetter(v, bestValue, direction))
              )),
            Match.orElse(() => Equal.equals(v, bestValue))
          )
        })

        return new Holding({ objectiveIndex, bestValue, holders })
      })),
    Match.exhaustive
  )
}
