/**
 * Stable extraction and ranking of non-dominated candidates.
 *
 * @since 0.1.0
 */

import { Numeric } from "@scenesystems/effect-math"
import { Array as Arr, Boolean, Equal, HashSet, Match, Number as Num, Option, Schema, Tuple } from "effect"

import type { Direction, DirectionSchema } from "../contracts/Direction.js"
import { dominatesNormalized, normalizeMatrix, validateRectangular } from "./dominance.js"
import { ObjectiveFrontierHolding } from "./model.js"
import type { ObjectiveVector, ObjectiveVectorSchema } from "./model.js"

type DirectionArray = Schema.Array$<typeof DirectionSchema>["Type"]
type NumberArray = Schema.Array$<typeof Schema.Number>["Type"]
type NumberMatrix = Schema.Array$<Schema.Array$<typeof Schema.Number>>["Type"]
type ObjectiveMatrix = Schema.Array$<typeof ObjectiveVectorSchema>["Type"]
type ObjectiveHoldings = Schema.Array$<typeof ObjectiveFrontierHolding>["Type"]

const isNonNaN = Schema.is(Schema.NonNaN)

const buildIndices = (count: number): NumberArray =>
  Boolean.match(Num.lessThanOrEqualTo(count, 0), {
    onFalse: () => Arr.range(0, Num.decrement(count)),
    onTrue: () => Arr.empty<number>()
  })

const defaultDirection = (): Direction => "minimize"

const directionAt = (directions: DirectionArray, index: number): Direction =>
  Arr.get(directions, index).pipe(Option.getOrElse(defaultDirection))

const defaultCoordinateValue = (direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => Number.NEGATIVE_INFINITY),
    Match.when("minimize", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

const coordinateAt = (point: ObjectiveVector, index: number, direction: Direction): number =>
  Arr.get(point, index).pipe(Option.getOrElse(() => defaultCoordinateValue(direction)))

const pointAt = (points: ObjectiveMatrix, index: number): ObjectiveVector =>
  Arr.get(points, index).pipe(Option.getOrElse(() => Arr.empty<number>()))

const objectiveDimensionCount = (points: ObjectiveMatrix): number =>
  Arr.head(points).pipe(Option.match({ onNone: () => 0, onSome: Arr.length }))

const normalizedAt = (normalized: ObjectiveMatrix, index: number): ObjectiveVector =>
  Arr.get(normalized, index).pipe(Option.getOrElse(() => Arr.empty<number>()))

const isBetter = (a: number, b: number, d: Direction): boolean =>
  Boolean.match(Boolean.and(isNonNaN(a), isNonNaN(b)), {
    onFalse: () => false,
    onTrue: () =>
      Match.value(d).pipe(
        Match.when("maximize", () => Num.greaterThan(a, b)),
        Match.when("minimize", () => Num.lessThan(a, b)),
        Match.exhaustive
      )
  })

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
  points: ObjectiveMatrix,
  directions: DirectionArray = Arr.empty(),
  epsilon = 0
): NumberArray =>
  Boolean.match(validateRectangular(points), {
    onFalse: () => Arr.empty<number>(),
    onTrue: () => {
      const normalized = normalizeMatrix(points, directions)
      return Arr.filter(buildIndices(Arr.length(points)), (index) =>
        Arr.every(normalized, (candidate, ci) =>
          Boolean.or(
            Equal.equals(ci, index),
            Boolean.not(dominatesNormalized(candidate, normalizedAt(normalized, index), epsilon))
          )))
    }
  })

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
  points: ObjectiveMatrix,
  directions: DirectionArray = Arr.empty(),
  epsilon = 0
): NumberMatrix =>
  Boolean.match(validateRectangular(points), {
    onFalse: () => Arr.empty<NumberArray>(),
    onTrue: () => {
      const n = Arr.length(points)
      const indices = buildIndices(n)
      const normalized = normalizeMatrix(points, directions)

      const zeroCounts: NumberArray = Arr.replicate(0, n)
      const emptyDominated: NumberMatrix = Arr.replicate(Arr.empty<number>(), n)

      const initial = Arr.reduce(indices, Tuple.make(zeroCounts, emptyDominated), (state, i) =>
        Arr.reduce(indices, state, (acc, j) =>
          Boolean.match(Equal.equals(i, j), {
            onFalse: () =>
              Boolean.match(dominatesNormalized(normalizedAt(normalized, i), normalizedAt(normalized, j), epsilon), {
                onFalse: () =>
                  acc,
                onTrue: () =>
                  Tuple.make(
                    Arr.modify(Tuple.getFirst(acc), j, Num.increment),
                    Arr.modify(Tuple.getSecond(acc), i, (dominated) =>
                      Arr.append(dominated, j))
                  )
              }),
            onTrue: () => acc
          })))

      const peel = (
        counts: NumberArray,
        remaining: HashSet.HashSet<number>,
        fronts: NumberMatrix
      ): NumberMatrix =>
        Boolean.match(Num.lessThanOrEqualTo(HashSet.size(remaining), 0), {
          onFalse: () => {
            const front = Arr.filter(
              indices,
              (i) =>
                Boolean.and(
                  HashSet.has(remaining, i),
                  Equal.equals(
                    Arr.get(counts, i).pipe(Option.getOrElse(() =>
                      0
                    )),
                    0
                  )
                )
            )

            return Boolean.match(Arr.isEmptyReadonlyArray(front), {
              onFalse: () => {
                const nextRemaining = HashSet.difference(remaining, HashSet.fromIterable(front))
                const nextCounts = Arr.reduce(front, counts, (cs, i) =>
                  Arr.reduce(
                    Arr.get(Tuple.getSecond(initial), i).pipe(Option.getOrElse(() => Arr.empty<number>())),
                    cs,
                    (inner, j) => Arr.modify(inner, j, Num.decrement)
                  ))

                return peel(nextCounts, nextRemaining, Arr.append(fronts, front))
              },
              onTrue: () => fronts
            })
          },
          onTrue: () => fronts
        })

      return peel(Tuple.getFirst(initial), HashSet.fromIterable(indices), Arr.empty<NumberArray>())
    }
  })

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
  points: ObjectiveMatrix,
  directions: DirectionArray = Arr.empty(),
  epsilon = 0
): NumberArray => {
  const fronts = nonDominatedSort(points, directions, epsilon)
  const indexSets = Arr.map(fronts, HashSet.fromIterable)

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
  points: ObjectiveMatrix,
  directions: DirectionArray = Arr.empty(),
  epsilon = 0
): ObjectiveHoldings =>
  Boolean.match(validateRectangular(points), {
    onFalse: () => Arr.empty<ObjectiveFrontierHolding>(),
    onTrue: () =>
      Arr.map(buildIndices(objectiveDimensionCount(points)), (objectiveIndex) => {
        const direction = directionAt(directions, objectiveIndex)
        const allIndices = buildIndices(Arr.length(points))

        const bestValue = Arr.reduce(allIndices, defaultCoordinateValue(direction), (best, ci) => {
          const v = coordinateAt(pointAt(points, ci), objectiveIndex, direction)
          return Boolean.match(isBetter(v, best, direction), {
            onFalse: () => best,
            onTrue: () => v
          })
        })

        const holders = Arr.filter(allIndices, (ci) => {
          const v = coordinateAt(pointAt(points, ci), objectiveIndex, direction)
          return Boolean.match(Num.greaterThan(epsilon, 0), {
            onFalse: () => Equal.equals(v, bestValue),
            onTrue: () =>
              Boolean.and(
                Num.lessThanOrEqualTo(Numeric.abs(Num.subtract(v, bestValue)), epsilon),
                Boolean.or(Equal.equals(v, bestValue), isBetter(v, bestValue, direction))
              )
          })
        })

        return new ObjectiveFrontierHolding({ objectiveIndex, bestValue, holders })
      })
  })
