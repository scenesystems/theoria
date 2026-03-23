/**
 * Trial number sequence generation for batch scheduling.
 *
 * @since 0.1.0
 */
import { Array as Arr, Match } from "effect"

/**
 * Generates a sequential array of trial numbers starting at the given offset.
 *
 * @since 0.1.0
 * @category utils
 */
export const trialNumbers = (count: number, startAt = 0): ReadonlyArray<number> =>
  Match.value(count <= 0).pipe(
    Match.when(true, () => Arr.empty<number>()),
    Match.orElse(() => Arr.makeBy(count, (index) => startAt + index))
  )
