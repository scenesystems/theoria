/**
 * Pure kernel for Shannon entropy computation over discrete probability
 * distributions represented as `Chunk<number>`.
 *
 * Delegates to `xlogy` from `Numeric/internal/logspace.ts` for the
 * 0·ln(0) = 0 convention — single source of truth for that identity.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N } from "effect"

import { xlogy } from "../../Numeric/internal/logspace.js"

/**
 * Shannon entropy: −Σ pᵢ · ln(pᵢ) for pᵢ > 0.
 * Zero-probability entries contribute 0 via `xlogy(0, 0) = 0`.
 *
 * @since 0.1.0
 * @category internal
 */
export const shannonEntropy = (probabilities: Chunk.Chunk<number>): number =>
  N.negate(
    Chunk.reduce(probabilities, 0, (acc, p) => N.sum(acc, xlogy(p, p)))
  )
