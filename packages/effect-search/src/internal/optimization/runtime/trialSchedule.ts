/**
 * Optimization trial-number generation for batch scheduling.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match, Number as Num } from "effect"

/**
 * Generates a sequential array of trial numbers starting at the given offset.
 *
 * @since 0.1.0
 * @category utils
 */
export const trialNumbers = (count: number, startAt = 0) =>
  Match.value(Num.lessThanOrEqualTo(count, 0)).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, (index) => Num.sum(startAt, index)))
  )
