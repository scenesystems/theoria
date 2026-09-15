/**
 * Numeric reduction kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as EffectNumber, Schema } from "effect"

class CompensatedSumState extends Schema.Class<CompensatedSumState>("CompensatedSumState")({
  compensation: Schema.Number,
  sum: Schema.Number
}) {}

/**
 * Sum a dense `Chunk<number>` in iteration order via `Number.sumAll`.
 *
 * @since 0.1.0
 * @category internal
 */
export const sumScalar = (values: Chunk.Chunk<number>): number => EffectNumber.sumAll(values)

/**
 * Kahan-compensated sum over a dense `Chunk<number>` carrier.
 *
 * @since 0.1.0
 * @category internal
 */
export const sumCompensated = (values: Chunk.Chunk<number>): number => {
  const state = Chunk.reduce(
    values,
    new CompensatedSumState({ compensation: 0, sum: 0 }),
    (current, value) => {
      const corrected = EffectNumber.subtract(value, current.compensation)
      const nextSum = EffectNumber.sum(current.sum, corrected)
      return new CompensatedSumState({
        compensation: EffectNumber.subtract(EffectNumber.subtract(nextSum, current.sum), corrected),
        sum: nextSum
      })
    }
  )
  return state.sum
}
