/**
 * Log-sum-exp over Chunk<number> with max-shift numerical stability.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N } from "effect"

/**
 * logsumexp(xs) = log(Σ exp(xᵢ)) computed as max + log(Σ exp(xᵢ - max)).
 * Returns -Infinity for empty chunks.
 *
 * @since 0.1.0
 * @category internal
 */
export const logsumexpChunk = (xs: Chunk.Chunk<number>): number => {
  const len = Chunk.size(xs)
  if (len === 0) return -Infinity
  if (len === 1) return Chunk.unsafeGet(xs, 0)

  const max = Chunk.reduce(xs, -Infinity, N.max)
  if (max === -Infinity) return -Infinity

  const sumExp = Chunk.reduce(xs, 0, (acc, x) => N.sum(acc, Math.exp(x - max)))
  return max + Math.log(sumExp)
}
