/**
 * Numeric scalar kernels.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Number, Option, pipe, Schema } from "effect"

const finite = Schema.is(Schema.Number.pipe(Schema.finite()))

/**
 * Finite-guarded safe division. Returns `None` when either operand or the
 * quotient is non-finite, including either signed zero divisor.
 */
export const safeDivideFinite = (dividend: number, divisor: number): Option.Option<number> =>
  Boolean.match(finite(dividend), {
    onFalse: Option.none,
    onTrue: () =>
      Boolean.match(finite(divisor), {
        onFalse: Option.none,
        onTrue: () => pipe(Number.divide(dividend, divisor), Option.filter(finite))
      })
  })
