/**
 * Digamma (psi) function kernel using asymptotic expansion with
 * recurrence shifting.
 *
 * For x ≥ 7 the asymptotic series converges quickly:
 *   ψ(x) ≈ ln(x) − 1/(2x) − Σ B₂ₖ/(2k · x²ᵏ)
 *
 * For 0 < x < 7 the recurrence relation ψ(x+1) = ψ(x) + 1/x is
 * applied through an Effect Iterable state transition to shift x into the
 * asymptotic range.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Iterable, Number, Option, Schema, Tuple } from "effect"

import { log } from "../../Numeric/index.js"

const ASYMPTOTIC_THRESHOLD = 7

const B2 = Number.unsafeDivide(1, 6)
const B4 = Number.unsafeDivide(-1, 30)
const B6 = Number.unsafeDivide(1, 42)
const B8 = Number.unsafeDivide(-1, 30)
const B10 = Number.unsafeDivide(5, 66)

class DigammaState extends Schema.Class<DigammaState>("DigammaState")({
  x: Schema.Number,
  correction: Schema.Number
}) {}

/**
 * ψ(x) via asymptotic expansion. Assumes x ≥ 7.
 *
 * @since 0.1.0
 * @category internal
 */
const digammaAsymptotic = (x: number): number => {
  const invX = Number.unsafeDivide(1, x)
  const invX2 = Number.multiply(invX, invX)

  return Number.subtract(
    log(x),
    Number.sum(
      Number.multiply(0.5, invX),
      Number.multiply(
        invX2,
        Number.sum(
          Number.sum(
            Number.sum(
              Number.multiply(B2, 0.5),
              Number.multiply(Number.multiply(B4, invX2), Number.unsafeDivide(1, 4))
            ),
            Number.multiply(Number.multiply(Number.multiply(B6, invX2), invX2), Number.unsafeDivide(1, 6))
          ),
          Number.sum(
            Number.multiply(
              Number.multiply(Number.multiply(Number.multiply(B8, invX2), invX2), invX2),
              Number.unsafeDivide(1, 8)
            ),
            Number.multiply(
              Number.multiply(Number.multiply(Number.multiply(Number.multiply(B10, invX2), invX2), invX2), invX2),
              Number.unsafeDivide(1, 10)
            )
          )
        )
      )
    )
  )
}

/**
 * Iterative recurrence shift: ψ(x) = ψ(x+1) − 1/x until x ≥ threshold.
 *
 * @since 0.1.0
 * @category internal
 */
const digammaRecurrence = (x: number, correction: number): number => {
  const initial = new DigammaState({ x, correction })
  const final = Iterable.reduce(
    Iterable.unfold(initial, (state) =>
      Boolean.match(Number.greaterThanOrEqualTo(state.x, ASYMPTOTIC_THRESHOLD), {
        onTrue: Option.none,
        onFalse: () => {
          const next = new DigammaState({
            x: Number.sum(state.x, 1),
            correction: Number.subtract(state.correction, Number.unsafeDivide(1, state.x))
          })
          return Option.some(Tuple.make(next, next))
        }
      })),
    initial,
    (_state, next) => next
  )
  return Number.sum(final.correction, digammaAsymptotic(final.x))
}

/**
 * ψ(x) for x > 0 using recurrence shifting into the asymptotic range.
 *
 * @since 0.1.0
 * @category internal
 */
export const digamma = (x: number): number => digammaRecurrence(x, 0)
