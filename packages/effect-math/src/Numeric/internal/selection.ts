/**
 * Numeric selection kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as EffectNumber, Option, pipe } from "effect"
import * as Arr from "effect/Array"

/**
 * Returns the index of the maximum element. `None` for empty arrays.
 * Ties broken by first index.
 *
 * @since 0.1.0
 * @category internal
 */
export const argmaxIndex = (values: ReadonlyArray<number>): Option.Option<number> =>
  pipe(
    Arr.head(values),
    Option.map(() => {
      const { bestIdx } = Arr.reduce(
        Arr.drop(values, 1),
        { index: 1, bestIdx: 0, bestVal: values[0]! },
        (acc, val) =>
          EffectNumber.greaterThan(val, acc.bestVal)
            ? { index: acc.index + 1, bestIdx: acc.index, bestVal: val }
            : { index: acc.index + 1, bestIdx: acc.bestIdx, bestVal: acc.bestVal }
      )
      return bestIdx
    })
  )
