/**
 * Categorical distribution kernels.
 * Parameters: probs (Chunk of non-negative probabilities summing to 1).
 * Support: k ∈ {0, 1, ..., n-1} where n = Chunk.size(probs).
 *
 * @since 0.1.0
 * @category internal
 */
import { Array, Boolean, Chunk, Number, Option } from "effect"

import { log } from "../../Numeric.js"

/**
 * PMF: P(X = k) = probs[k] for k ∈ {0, ..., n-1}, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalPmf = (k: number, probs: Chunk.Chunk<number>): number =>
  Option.getOrElse(Chunk.get(probs, k), () => 0)

/**
 * Log-PMF: ln P(X = k) = ln(probs[k]) for k in range, else -Infinity.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalLogpmf = (k: number, probs: Chunk.Chunk<number>): number =>
  Option.match(Chunk.get(probs, k), {
    onSome: log,
    onNone: () => -Infinity
  })

/**
 * CDF: P(X ≤ k) = Σ_{i=0}^{k} probs[i].
 * Returns 0 for k < 0, 1 for k ≥ n-1.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalCdf = (k: number, probs: Chunk.Chunk<number>): number => {
  return Boolean.match(Number.lessThan(k, 0), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.greaterThanOrEqualTo(k, Number.subtract(Chunk.size(probs), 1)), {
        onTrue: () => 1,
        onFalse: () => Chunk.reduce(Chunk.take(probs, Number.sum(k, 1)), 0, Number.sum)
      })
  })
}

/**
 * Mean: E[X] = Σ i · p_i.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalMean = (probs: Chunk.Chunk<number>): number => {
  const indices = Chunk.fromIterable(Array.range(0, Number.subtract(Chunk.size(probs), 1)))
  return Chunk.reduce(Chunk.zip(indices, probs), 0, (acc, [i, p]) => Number.sum(acc, Number.multiply(i, p)))
}

/**
 * Variance: Var(X) = E[X²] − (E[X])².
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalVariance = (probs: Chunk.Chunk<number>): number => {
  const mu = categoricalMean(probs)
  const indices = Chunk.fromIterable(Array.range(0, Number.subtract(Chunk.size(probs), 1)))
  const e2 = Chunk.reduce(
    Chunk.zip(indices, probs),
    0,
    (acc, [i, p]) => Number.sum(acc, Number.multiply(Number.multiply(i, i), p))
  )
  return Number.subtract(e2, Number.multiply(mu, mu))
}
