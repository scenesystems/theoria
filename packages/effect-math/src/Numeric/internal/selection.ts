/**
 * Numeric selection kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Number, Option, pipe, Schema } from "effect"

class MaximumState extends Schema.Class<MaximumState>("MaximumState")({
  bestIndex: Schema.Number,
  bestValue: Schema.Number,
  index: Schema.Number
}) {}

/** Returns the first index of the maximum element, or `None` when empty. */
export const argmaxIndex = (values: Iterable<number>): Option.Option<number> =>
  pipe(Chunk.fromIterable(values), (values) =>
    pipe(
      Chunk.head(values),
      Option.map((first) =>
        Chunk.reduce(
          Chunk.drop(values, 1),
          new MaximumState({ bestIndex: 0, bestValue: first, index: 1 }),
          (state, value) =>
            Boolean.match(Number.greaterThan(value, state.bestValue), {
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
            })
        ).bestIndex
      )
    ))
