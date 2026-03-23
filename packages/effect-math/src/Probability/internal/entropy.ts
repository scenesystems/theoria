/**
 * Pure kernel for Shannon entropy computation over discrete probability
 * distributions represented as `Chunk<number>`.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N } from "effect"

/**
 * Shannon entropy: −Σ pᵢ · ln(pᵢ) for pᵢ > 0.
 * Zero-probability entries contribute 0 (convention: 0 · ln(0) = 0).
 *
 * @since 0.1.0
 * @category internal
 */
export const shannonEntropy = (probabilities: Chunk.Chunk<number>): number =>
  N.negate(
    Chunk.reduce(probabilities, 0, (acc, p) => N.sum(acc, N.greaterThan(p, 0) ? N.multiply(p, Math.log(p)) : 0))
  )
