/**
 * Categorical distribution kernels.
 * Parameters: probs (Chunk of non-negative probabilities summing to 1).
 * Support: k ∈ {0, 1, ..., n-1} where n = Chunk.size(probs).
 *
 * @since 0.1.0
 * @category internal
 */
import { Array as Arr, Chunk, Number as N } from "effect"

import { xlogy } from "../../Numeric/operations.js"

/**
 * PMF: P(X = k) = probs[k] for k ∈ {0, ..., n-1}, else 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalPmf = (k: number, probs: Chunk.Chunk<number>): number =>
  (N.greaterThanOrEqualTo(k, 0) && N.lessThan(k, Chunk.size(probs)))
    ? Chunk.unsafeGet(probs, k)
    : 0

/**
 * Log-PMF: ln P(X = k) = ln(probs[k]) for k in range, else -Infinity.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalLogpmf = (k: number, probs: Chunk.Chunk<number>): number =>
  (N.greaterThanOrEqualTo(k, 0) && N.lessThan(k, Chunk.size(probs)))
    ? Math.log(Chunk.unsafeGet(probs, k))
    : -Infinity

/**
 * CDF: P(X ≤ k) = Σ_{i=0}^{k} probs[i].
 * Returns 0 for k < 0, 1 for k ≥ n-1.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalCdf = (k: number, probs: Chunk.Chunk<number>): number => {
  if (N.lessThan(k, 0)) return 0
  if (N.greaterThanOrEqualTo(k, N.subtract(Chunk.size(probs), 1))) return 1
  return Chunk.reduce(Chunk.take(probs, N.sum(k, 1)), 0, (acc, p) => N.sum(acc, p))
}

/**
 * Mean: E[X] = Σ i · p_i.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalMean = (probs: Chunk.Chunk<number>): number => {
  const indices = Chunk.fromIterable(Arr.range(0, Chunk.size(probs) - 1))
  return Chunk.reduce(Chunk.zip(indices, probs), 0, (acc, [i, p]) => N.sum(acc, N.multiply(i, p)))
}

/**
 * Variance: Var(X) = E[X²] − (E[X])².
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalVariance = (probs: Chunk.Chunk<number>): number => {
  const mu = categoricalMean(probs)
  const indices = Chunk.fromIterable(Arr.range(0, Chunk.size(probs) - 1))
  const e2 = Chunk.reduce(
    Chunk.zip(indices, probs),
    0,
    (acc, [i, p]) => N.sum(acc, N.multiply(N.multiply(i, i), p))
  )
  return N.subtract(e2, N.multiply(mu, mu))
}

/**
 * Entropy: H(X) = −Σ p_i · ln(p_i) for p_i > 0.
 * Uses xlogy(x, y) = x · ln(y) with x=0 → 0 convention.
 *
 * @since 0.1.0
 * @category internal
 */
export const categoricalEntropy = (probs: Chunk.Chunk<number>): number =>
  N.negate(Chunk.reduce(probs, 0, (acc, p) => N.sum(acc, xlogy(p, p))))
