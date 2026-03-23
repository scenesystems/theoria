/**
 * Percentile threshold computation with direction-aware interpolation.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num, Option } from "effect"

import type { Direction } from "../../contracts/Direction.js"

const numberAt = (values: ReadonlyArray<number>, index: number, fallback: number): number =>
  Arr.get(values, index).pipe(Option.getOrElse(() => fallback))

const clampPercentile = (percentile: number): number =>
  Num.clamp(percentile, {
    minimum: 0,
    maximum: 100
  })

/**
 * Adjusts a percentile threshold for direction: for maximize, the complement (100 - p) is used to prune the bottom performers.
 *
 * @since 0.1.0
 * @category utils
 */
export const percentileForDirection = (direction: Direction, percentile: number): number =>
  Match.value(direction).pipe(
    Match.when("maximize", () => 100 - percentile),
    Match.orElse(() => percentile)
  )

/**
 * Computes an interpolated percentile value from a sorted numeric array, ignoring NaN entries.
 *
 * @since 0.1.0
 * @category utils
 */
export const percentileValue = (values: ReadonlyArray<number>, percentile: number): number => {
  const nonNaN = Arr.filter(values, (value) => !Number.isNaN(value))
  const ordered = Arr.sort(nonNaN, Num.Order)

  return Match.value(ordered.length === 0).pipe(
    Match.when(true, () => Number.NaN),
    Match.orElse(() => {
      const rank = Num.unsafeDivide(clampPercentile(percentile), 100) * (ordered.length - 1)
      const lowerIndex = Math.floor(rank)
      const upperIndex = Math.ceil(rank)
      const lower = numberAt(ordered, lowerIndex, Number.NaN)
      const upper = numberAt(ordered, upperIndex, Number.NaN)

      return lower + (upper - lower) * (rank - lowerIndex)
    })
  )
}
