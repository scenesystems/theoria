/**
 * Numeric reduction kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Data, Iterable, Match, Number } from "effect"

import { floor } from "./binary.js"
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

/** NumPy contiguous float64 reduction, loops_utils.h.src (PW_BLOCKSIZE=128).
 * The outer reduction starts from +0; the inner short block starts from -0.
 */
export const sumPairwise = (values: Chunk.Chunk<number>): number => {
  const block = (values: Chunk.Chunk<number>): number => {
    const size = Chunk.size(values)
    return Match.value(size).pipe(
      Match.when(Number.isLessThan(8), () => Chunk.reduce(values, -0, Number.sum)),
      Match.when(Number.isLessThanOrEqualTo(128), () => {
        const prefix = Number.subtract(size, Number.remainder(size, 8))
        const lanes = Chunk.reduce(
          Chunk.chunksOf(Chunk.take(Chunk.drop(values, 8), Number.subtract(prefix, 8)), 8),
          Chunk.take(values, 8),
          (lanes, next) => Chunk.zipWith(lanes, next, Number.sum)
        )
        const pair = (index: number) =>
          Number.sum(Chunk.getUnsafe(lanes, index), Chunk.getUnsafe(lanes, Number.increment(index)))
        const subtotal = Number.sum(Number.sum(pair(0), pair(2)), Number.sum(pair(4), pair(6)))
        return Chunk.reduce(Chunk.drop(values, prefix), subtotal, Number.sum)
      }),
      Match.orElse(() => {
        const half = floor(Number.divideUnsafe(size, 2))
        const split = Number.subtract(half, Number.remainder(half, 8))
        return Number.sum(block(Chunk.take(values, split)), block(Chunk.drop(values, split)))
      })
    )
  }
  return Number.sum(0, block(values))
}

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
