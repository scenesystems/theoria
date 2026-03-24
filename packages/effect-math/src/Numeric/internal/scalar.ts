/**
 * Numeric scalar kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as EffectNumber, Option, pipe } from "effect"

/**
 * Finite-guarded safe division. Returns `None` when divisor is zero,
 * either operand is non-finite, or the result is non-finite.
 *
 * @since 0.1.0
 * @category internal
 */
export const safeDivideFinite = (dividend: number, divisor: number): Option.Option<number> =>
  Number.isFinite(dividend) && Number.isFinite(divisor)
    ? pipe(
      EffectNumber.divide(dividend, divisor),
      Option.filter(Number.isFinite)
    )
    : Option.none()
