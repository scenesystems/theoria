/**
 * Numeric selection kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Data, Number, Option, pipe } from "effect"

import * as Binary from "./binary.js"

class MaximumState extends Data.Class<{
  readonly bestIndex: number
  readonly bestValue: number
  readonly index: number
}> {}

/**
 * Returns the first index of the maximum element, or `None` when empty.
 * Ordered values supersede NaN; an all-NaN input retains its first index.
 */
export const argmaxIndex = (values: Iterable<number>): Option.Option<number> =>
  pipe(Chunk.fromIterable(values), (values) =>
    pipe(
      Chunk.head(values),
      Option.map((first) =>
        Chunk.reduce(
          Chunk.drop(values, 1),
          new MaximumState({ bestIndex: 0, bestValue: first, index: 1 }),
          (state, value) =>
            Boolean.match(
              Boolean.and(Boolean.not(Binary.isNaN(value)), Number.greaterThan(value, state.bestValue)),
              {
                onTrue: () =>
                  new MaximumState({
                    bestIndex: state.index,
                    bestValue: value,
                    index: Number.increment(state.index)
                  }),
                onFalse: () =>
                  new MaximumState({
                    bestIndex: state.bestIndex,
                    bestValue: state.bestValue,
                    index: Number.increment(state.index)
                  })
              }
            )
        ).bestIndex
      )
    ))
