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
import { Array, Boolean, Chunk, Number, Option, pipe } from "effect"

/**
 * Evaluates polynomial at `x` via Horner's method. Coefficients are
 * lowest-degree-first: `[a0, a1, a2]` = a0 + a1·x + a2·x².
 * Processes right-to-left: result = ((a2·x + a1)·x + a0).
 *
 * @since 0.1.0
 * @category internal
 */
export const polyEval = (coefficients: Chunk.Chunk<number>, x: number): number => {
  return Option.match(Chunk.last(coefficients), {
    onNone: () => 0,
    onSome: (leading) =>
      Boolean.match(
        Boolean.and(
          Number.Equivalence(Number.subtract(x, x), 0),
          Boolean.not(Number.Equivalence(leading, 0))
        ),
        {
          onTrue: () =>
            Array.reduceRight(
              Chunk.toReadonlyArray(coefficients),
              0,
              (acc, coeff) => Number.sum(coeff, Number.multiply(acc, x))
            ),
          onFalse: () =>
            Chunk.reduceRight(
              Chunk.dropRight(coefficients, 1),
              leading,
              (acc, coeff) => Number.sum(coeff, Number.multiply(acc, x))
            )
        }
      )
  })
}

/**
 * Computes the formal derivative of polynomial coefficients.
 * `[a0, a1, a2, a3]` → `[a1, 2·a2, 3·a3]`.
 * A constant polynomial (single coefficient) yields `[0]`.
 *
 * @since 0.1.0
 * @category internal
 */
export const polyDerivative = (coefficients: Chunk.Chunk<number>): Chunk.Chunk<number> =>
  Boolean.match(Number.lessThanOrEqualTo(Chunk.size(coefficients), 1), {
    onTrue: () => Chunk.of(0),
    onFalse: () =>
      pipe(
        Chunk.drop(coefficients, 1),
        Chunk.map((coeff, i) => Number.multiply(coeff, Number.increment(i)))
      )
  })
