/**
 * Log-sum-exp over Chunk<number> with max-shift numerical stability.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Match, Number as N, Schema } from "effect"

const NEGATIVE_INFINITY = N.negate(Infinity)
const isNonNaN = Schema.is(Schema.NonNaN)

/**
 * logSumExp(xs) = log(Σ exp(xᵢ)) computed as max + log(Σ exp(xᵢ - max)).
 * Returns -Infinity for empty chunks. NaN propagates; otherwise positive
 * infinity dominates the sum.
 *
 * @since 0.1.0
 * @category internal
 */
export const logSumExpChunk = (xs: Chunk.Chunk<number>): number => {
  return Match.value(Chunk.every(xs, isNonNaN)).pipe(
    Match.when(false, () => NaN),
    Match.when(true, () =>
      Match.value(Chunk.size(xs)).pipe(
        Match.when(0, () => NEGATIVE_INFINITY),
        Match.when(1, () => Chunk.unsafeGet(xs, 0)),
        Match.orElse(() =>
          Match.value(Chunk.reduce(xs, NEGATIVE_INFINITY, N.max)).pipe(
            Match.when(NEGATIVE_INFINITY, () => NEGATIVE_INFINITY),
            Match.when(Infinity, () => Infinity),
            Match.orElse((max) => {
              const sumExp = Chunk.reduce(xs, 0, (acc, x) => N.sum(acc, Math.exp(N.subtract(x, max))))
              return N.sum(max, Math.log(sumExp))
            })
          )
        )
      )),
    Match.exhaustive
  )
}
