/**
 * Numeric selection kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Number as EffectNumber, Option, Schema } from "effect"

class ArgmaxState extends Schema.Class<ArgmaxState>("ArgmaxState")({
  bestIndex: Schema.NonNegativeInt,
  bestValue: Schema.Number
}) {}
const isNonNaN = Schema.is(Schema.NonNaN)

/**
 * Returns the index of the maximum element. `None` for an empty chunk.
 * Ties use the first index. Ordered values supersede NaN; an all-NaN chunk
 * retains its first index.
 *
 * @since 0.1.0
 * @category internal
 */
export const argmaxIndex = (values: Chunk.Chunk<number>): Option.Option<number> =>
  Option.map(
    Chunk.reduce(values, Option.none<ArgmaxState>(), (state, value, index) =>
      Option.match(state, {
        onNone: () => Option.some(new ArgmaxState({ bestIndex: index, bestValue: value })),
        onSome: (current) =>
          Option.some(
            Boolean.match(Boolean.and(isNonNaN(value), EffectNumber.greaterThan(value, current.bestValue)), {
              onFalse: () => current,
              onTrue: () => new ArgmaxState({ bestIndex: index, bestValue: value })
            })
          )
      })),
    (state) => state.bestIndex
  )
