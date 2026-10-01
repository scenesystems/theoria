/**
 * Numeric reduction kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { type Chunk, Data, Iterable, Number } from "effect"

import { log } from "./transcendental.js"

class CompensatedSum extends Data.Class<{
  readonly compensation: number
  readonly sum: number
}> {}

/** Sum over an iterable in iteration order. */
export const sumScalar: (values: Iterable<number>) => number = Number.sumAll

/** Kahan-compensated sum over an iterable carrier. */
export const sumCompensated = (values: Iterable<number>): number =>
  Iterable.reduce(values, new CompensatedSum({ compensation: 0, sum: 0 }), (state, value) => {
    const adjusted = Number.subtract(value, state.compensation)
    const sum = Number.sum(state.sum, adjusted)
    return new CompensatedSum({
      compensation: Number.subtract(Number.subtract(sum, state.sum), adjusted),
      sum
    })
  }).sum

/** Sum over a dense immutable chunk. */
export const sumChunk = (values: Chunk.Chunk<number>): number => Number.sumAll(values)

/** Kahan-compensated sum of natural logarithms over an iterable carrier. */
export const sumLog = (values: Iterable<number>): number =>
  Iterable.reduce(values, new CompensatedSum({ compensation: 0, sum: 0 }), (state, value) => {
    const adjusted = Number.subtract(log(value), state.compensation)
    const sum = Number.sum(state.sum, adjusted)
    return new CompensatedSum({
      compensation: Number.subtract(Number.subtract(sum, state.sum), adjusted),
      sum
    })
  }).sum
