/**
 * Numeric scalar kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number as EffectNumber, Option, pipe, Schema } from "effect"

const isFinite = Schema.is(Schema.Finite)

/**
 * Finite-guarded safe division. Returns `None` when divisor is zero,
 * either operand is non-finite, or the result is non-finite.
 *
 * @since 0.1.0
 * @category internal
 */
export const safeDivideFinite = (dividend: number, divisor: number): Option.Option<number> =>
  Boolean.match(Boolean.and(isFinite(dividend), isFinite(divisor)), {
    onFalse: Option.none,
    onTrue: () =>
      pipe(
        EffectNumber.divide(dividend, divisor),
        Option.filter(isFinite)
      )
  })
