/**
 * Pareto frontier extraction and ranking.
 *
 * @since 0.1.0
 */

import { Array as Arr, Equal, HashSet, Match, Number as Num, Option } from "effect"

import type { Direction } from "../contracts/Direction.js"
import { dominatesNormalized, normalizeMatrix, validateRectangular } from "./dominance.js"
import { ObjectiveFrontierHolding, type ObjectiveVector } from "./model.js"

const buildIndices = (count: number): ReadonlyArray<number> =>
  count <= 0 ? Arr.empty<number>() : Arr.range(0, count - 1)

const defaultDirection = (): Direction => "minimize"

const directionAt = (directions: ReadonlyArray<Direction>, index: number): Direction =>
  Arr.get(directions, index).pipe(Option.getOrElse(defaultDirection))

const defaultCoordinateValue = (direction: Direction): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => Number.NEGATIVE_INFINITY),
    Match.when("minimize", () => Number.POSITIVE_INFINITY),
    Match.exhaustive
  )

const coordinateAt = (point: ObjectiveVector, index: number, direction: Direction): number =>
  Arr.get(point, index).pipe(Option.getOrElse(() => defaultCoordinateValue(direction)))

const pointAt = (points: ReadonlyArray<ObjectiveVector>, index: number): ObjectiveVector =>
  Arr.get(points, index).pipe(Option.getOrElse(() => Arr.empty<number>()))

const objectiveDimensionCount = (points: ReadonlyArray<ObjectiveVector>): number =>
  Arr.head(points).pipe(Option.match({ onNone: () => 0, onSome: (p) => p.length }))

const normalizedAt = (normalized: ReadonlyArray<ObjectiveVector>, index: number): ObjectiveVector =>
  Arr.get(normalized, index).pipe(Option.getOrElse(() => Arr.empty<number>()))

const isBetter = (a: number, b: number, d: Direction): boolean =>
  Match.value(d).pipe(
    Match.when("maximize", () => a > b),
    Match.when("minimize", () => a < b),
    Match.exhaustive
  )

/**
 * Returns the index set of candidates that belong to the first non-dominated frontier.
 *
 * A candidate is non-dominated when no other candidate in `points` Pareto-dominates it.
 * The returned indices are a subset of `[0, points.length)` and are stable (preserve
 * input order). Pass `epsilon > 0` to require a strict margin for dominance.
 *
 * @see {@link dominates} from `./dominance` — pairwise test used internally
 * @see {@link nonDominatedSort} Iterative peeling that calls this repeatedly
 * @see {@link ObjectiveVector} from `./model` — input vector type
 *
 * @since 0.1.0
 * @category frontier
 */
export const nonDominatedIndices = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): ReadonlyArray<number> =>
  Match.value(validateRectangular(points)).pipe(
    Match.when(false, () => Arr.empty<number>()),
    Match.when(true, () => {
      const normalized = normalizeMatrix(points, directions)
      return Arr.filter(buildIndices(points.length), (index) =>
        Arr.every(normalized, (candidate, ci) =>
          Equal.equals(ci, index) ||
          !dominatesNormalized(candidate, normalizedAt(normalized, index), epsilon)))
    }),
    Match.exhaustive
  )

/**
 * Performs iterative front peeling (NSGA-II style) and returns front index groups in rank order.
 *
 * Each successive front is the non-dominated set of the remaining candidates after
 * removing all previously assigned fronts. `result[0]` is the Pareto-optimal front,
 * `result[1]` is the second front, and so on until all candidates are assigned.
 *
 * @see {@link nonDominatedIndices} Extracts a single front (used per peeling iteration)
 * @see {@link nonDominatedRanks} Flat per-candidate rank derived from this sort
 * @see {@link dominates} from `./dominance` — underlying pairwise dominance check
 *
 * @since 0.1.0
 * @category frontier
 */
export const nonDominatedSort = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): ReadonlyArray<ReadonlyArray<number>> =>
  Match.value(validateRectangular(points)).pipe(
    Match.when(false, () => Arr.empty<ReadonlyArray<number>>()),
    Match.when(true, () => {
      const n = points.length
      const indices = buildIndices(n)
      const normalized = normalizeMatrix(points, directions)

      const zeroCounts: ReadonlyArray<number> = Arr.replicate(0, n)
      const emptyDominated: ReadonlyArray<ReadonlyArray<number>> = Arr.replicate(Arr.empty<number>(), n)

      const initial = Arr.reduce(indices, {
        counts: zeroCounts,
        dominated: emptyDominated
      }, (state, i) =>
        Arr.reduce(indices, state, (acc, j) =>
          Equal.equals(i, j)
            ? acc
            : dominatesNormalized(normalizedAt(normalized, i), normalizedAt(normalized, j), epsilon)
            ? ({
              counts: Arr.modify(acc.counts, j, (c) => c + 1),
              dominated: Arr.modify(acc.dominated, i, (l) => Arr.append(l, j))
            })
            : acc))

      const peel = (
        counts: ReadonlyArray<number>,
        remaining: HashSet.HashSet<number>,
        fronts: ReadonlyArray<ReadonlyArray<number>>
      ): ReadonlyArray<ReadonlyArray<number>> =>
        HashSet.size(remaining) <= 0 ?
          fronts
          : (() => {
            const front = Arr.filter(
              indices,
              (i) => HashSet.has(remaining, i) && Equal.equals(Arr.get(counts, i).pipe(Option.getOrElse(() => 0)), 0)
            )

            return Arr.isEmptyReadonlyArray(front) ?
              fronts
              : (() => {
                const nextRemaining = HashSet.difference(remaining, HashSet.fromIterable(front))
                const nextCounts = Arr.reduce(front, counts, (cs, i) =>
                  Arr.reduce(
                    Arr.get(initial.dominated, i).pipe(Option.getOrElse(() => Arr.empty<number>())),
                    cs,
                    (inner, j) => Arr.modify(inner, j, (c) => c - 1)
                  ))

                return peel(nextCounts, nextRemaining, Arr.append(fronts, front))
              })()
          })()

      return peel(initial.counts, HashSet.fromIterable(indices), Arr.empty<ReadonlyArray<number>>())
    }),
    Match.exhaustive
  )

/**
 * Maps each candidate index to its non-dominated front rank (0-based).
 *
 * Rank `0` means the candidate is on the Pareto-optimal front, rank `1` is the
 * second front, etc. Returns `Infinity` for any index not found in the sort result,
 * which should not happen with well-formed input.
 *
 * @see {@link nonDominatedSort} Produces the front groups this flattens
 * @see {@link nonDominatedIndices} First front only (rank 0)
 *
 * @since 0.1.0
 * @category frontier
 */
export const nonDominatedRanks = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): ReadonlyArray<number> => {
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
 * Compute non-dominated holder sets independently per objective coordinate.
 *
 * Projects the full objective matrix onto each coordinate in turn, runs single-objective
 * non-dominated extraction, and records which candidates are holders plus the best value.
 * This is the building block for Pareto-parent weighting strategies that count how often
 * each candidate appears on per-objective frontiers.
 *
 * @see {@link ObjectiveFrontierHolding} from `./model` — return element type
 * @see {@link ObjectiveFrontierWeight} from `./model` — downstream weight derived from these
 * @see {@link objectiveFrontierWeights} from `./weights` — aggregates holdings into weights
 * @see {@link nonDominatedIndices} Used internally per projected coordinate
 *
 * @since 0.1.0
 * @category frontier
 */
export const objectiveFrontierHoldings = (
  points: ReadonlyArray<ObjectiveVector>,
  directions: ReadonlyArray<Direction> = [],
  epsilon = 0
): ReadonlyArray<ObjectiveFrontierHolding> =>
  Match.value(validateRectangular(points)).pipe(
    Match.when(false, () => Arr.empty<ObjectiveFrontierHolding>()),
    Match.when(true, () =>
      Arr.map(buildIndices(objectiveDimensionCount(points)), (objectiveIndex) => {
        const direction = directionAt(directions, objectiveIndex)
        const allIndices = buildIndices(points.length)

        const bestValue = Arr.reduce(allIndices, defaultCoordinateValue(direction), (best, ci) => {
          const v = coordinateAt(pointAt(points, ci), objectiveIndex, direction)
          return isBetter(v, best, direction) ? v : best
        })

        const holders = Arr.filter(allIndices, (ci) => {
          const v = coordinateAt(pointAt(points, ci), objectiveIndex, direction)
          return epsilon > 0
            ? Num.lessThanOrEqualTo(Math.abs(v - bestValue), epsilon) &&
              (Equal.equals(v, bestValue) || isBetter(v, bestValue, direction))
            : Equal.equals(v, bestValue)
        })

        return new ObjectiveFrontierHolding({ objectiveIndex, bestValue, holders })
      })),
    Match.exhaustive
  )
