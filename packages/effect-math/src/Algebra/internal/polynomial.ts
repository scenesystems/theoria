/**
 * Polynomial evaluation and differentiation kernels.
 *
 * `polyEval` uses Horner's method (right-to-left accumulation) for
 * numerically stable O(n) evaluation. `polyDerivative` computes the
 * formal derivative of a coefficient array. Coefficients are
 * lowest-degree-first: `[a0, a1, a2]` represents `a0 + a1·x + a2·x²`.
 *
 * @since 0.1.0
 * @category internal
 */
import { Chunk, Number as N, pipe } from "effect"

/**
 * Evaluates polynomial at `x` via Horner's method. Coefficients are
 * lowest-degree-first: `[a0, a1, a2]` = a0 + a1·x + a2·x².
 * Processes right-to-left: result = ((a2·x + a1)·x + a0).
 *
 * @since 0.1.0
 * @category internal
 */
export const polyEval = (coefficients: Chunk.Chunk<number>, x: number): number => {
  if (Chunk.isEmpty(coefficients)) return 0

  const reversed = Chunk.reverse(coefficients)

  return pipe(
    Chunk.drop(reversed, 1),
    Chunk.reduce(
      Chunk.unsafeGet(reversed, 0),
      (acc, coeff) => N.sum(coeff, N.multiply(acc, x))
    )
  )
}

/**
 * Computes the formal derivative of polynomial coefficients.
 * `[a0, a1, a2, a3]` → `[a1, 2·a2, 3·a3]`.
 * A constant polynomial (single coefficient) yields `[0]`.
 *
 * @since 0.1.0
 * @category internal
 */
export const polyDerivative = (coefficients: Chunk.Chunk<number>): Chunk.Chunk<number> => {
  if (Chunk.size(coefficients) <= 1) return Chunk.of(0)

  return pipe(
    Chunk.drop(coefficients, 1),
    Chunk.map((coeff, i) => N.multiply(coeff, N.sum(i, 1)))
  )
}
