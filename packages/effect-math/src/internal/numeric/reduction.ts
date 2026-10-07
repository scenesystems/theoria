/**
 * Numeric reduction kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Chunk, Data, Iterable, Match, Number, Schema } from "effect"

import { abs, floor } from "./binary.js"
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

const isFiniteNumber = Schema.is(Schema.Finite)

/** CPython 3.12 builtin `sum` over floats, Python/bltinmodule.c `builtin_sum_impl`.
 * The integer start contributes `0 + x0`, which equals a Neumaier step from `(+0, +0)`:
 * the first compensation is zero for finite input and non-finite input makes the
 * final compensation non-finite either way. The compensation is added once at the
 * end, only when it is nonzero and finite, so signed totals and overflowed or
 * infinite totals are not turned into NaN.
 */
export const sumNeumaier = (values: Iterable<number>): number => {
  const total = Iterable.reduce(values, new CompensatedSum({ compensation: 0, sum: 0 }), (state, value) => {
    const sum = Number.sum(state.sum, value)
    const error = Boolean.match(Number.isGreaterThanOrEqualTo(abs(state.sum), abs(value)), {
      onFalse: () => Number.sum(Number.subtract(value, sum), state.sum),
      onTrue: () => Number.sum(Number.subtract(state.sum, sum), value)
    })
    return new CompensatedSum({ compensation: Number.sum(state.compensation, error), sum })
  })
  return Boolean.match(
    Boolean.and(isFiniteNumber(total.compensation), Boolean.not(Number.Equivalence(total.compensation, 0))),
    {
      onFalse: () => total.sum,
      onTrue: () => Number.sum(total.sum, total.compensation)
    }
  )
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
