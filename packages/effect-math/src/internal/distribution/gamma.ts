/**
 * Gamma distribution kernels.
 * Parameters: shape (k > 0), scale (θ > 0). Mean = kθ.
 *
 * CDF and normalization delegate to canonical public Special operations.
 *
 * @since 0.1.0
 * @category internal
 */
import { Boolean, Iterable, Number, Option, Schema, Tuple } from "effect"

import { abs, exp, log } from "../../Numeric.js"
import { digamma, gammainc, lnGamma } from "../../Special.js"

class GammaQuantileState
  extends Schema.Class<GammaQuantileState>("@scenesystems/effect-math/internal/distribution/gamma/QuantileState")({
    x: Schema.Number,
    remaining: Schema.Number
  })
{}

/**
 * Gamma PDF: x^{k−1} e^{−x/θ} / (θ^k Γ(k)) for x > 0.
 *
 * Handles x = 0 with shape = 1 as the limiting density 1/θ.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaPdf = (x: number, shape: number, scale: number): number => {
  return Boolean.match(Number.lessThan(x, 0), {
    onTrue: () => 0,
    onFalse: () =>
      Boolean.match(Number.Equivalence(x, 0), {
        onTrue: () =>
          Boolean.match(Number.Equivalence(shape, 1), {
            onTrue: () => Number.unsafeDivide(1, scale),
            onFalse: () => 0
          }),
        onFalse: () =>
          exp(
            Number.subtract(
              Number.subtract(
                Number.multiply(Number.subtract(shape, 1), log(x)),
                Number.unsafeDivide(x, scale)
              ),
              Number.sum(
                Number.multiply(shape, log(scale)),
                lnGamma(shape)
              )
            )
          )
      })
  })
}

/**
 * Gamma log-PDF: (k−1)ln(x) − x/θ − k·ln(θ) − ln Γ(k).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaLogpdf = (x: number, shape: number, scale: number): number => {
  return Boolean.match(Number.lessThanOrEqualTo(x, 0), {
    onTrue: () => -Infinity,
    onFalse: () =>
      Number.subtract(
        Number.subtract(
          Number.multiply(Number.subtract(shape, 1), log(x)),
          Number.unsafeDivide(x, scale)
        ),
        Number.sum(
          Number.multiply(shape, log(scale)),
          lnGamma(shape)
        )
      )
  })
}

/**
 * Gamma CDF via regularized lower incomplete gamma P(k, x/θ).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaCdf = (x: number, shape: number, scale: number): number => {
  return Boolean.match(Number.lessThanOrEqualTo(x, 0), {
    onTrue: () => 0,
    onFalse: () => gammainc(shape, Number.unsafeDivide(x, scale))
  })
}

/**
 * Schema-state Newton–Raphson iteration for the gamma quantile.
 *
 * @since 0.1.0
 * @category internal
 */
const gammaQuantileLoop = (
  p: number,
  shape: number,
  scale: number,
  x: number,
  remaining: number
): number => {
  const initial = new GammaQuantileState({ x, remaining })
  return Iterable.reduce(
    Iterable.unfold(initial, (state) => {
      const difference = Number.subtract(gammaCdf(state.x, shape, scale), p)
      const density = gammaPdf(state.x, shape, scale)
      return Boolean.match(
        Boolean.or(
          Number.Equivalence(state.remaining, 0),
          Boolean.or(Number.lessThan(density, 1e-30), Number.lessThan(abs(difference), 1e-12))
        ),
        {
          onTrue: Option.none,
          onFalse: () => {
            const next = new GammaQuantileState({
              x: Number.max(1e-15, Number.subtract(state.x, Number.unsafeDivide(difference, density))),
              remaining: Number.subtract(state.remaining, 1)
            })
            return Option.some(Tuple.make(next.x, next))
          }
        }
      )
    }),
    x,
    (_x, next) => next
  )
}

/**
 * Gamma quantile (inverse CDF) via Newton–Raphson iteration.
 *
 * Returns x such that P(k, x/θ) ≈ p. Initial guess uses shape·scale
 * scaled by p for small p.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaQuantile = (p: number, shape: number, scale: number): number => {
  const guess = Boolean.match(Number.lessThan(p, 0.05), {
    onTrue: () => Number.max(1e-10, Number.multiply(Number.multiply(shape, scale), p)),
    onFalse: () => Number.multiply(shape, scale)
  })
  return gammaQuantileLoop(p, shape, scale, guess, 50)
}

/**
 * Gamma mean: kθ.
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaMean = (shape: number, scale: number): number => Number.multiply(shape, scale)

/**
 * Gamma variance: kθ².
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaVariance = (shape: number, scale: number): number =>
  Number.multiply(shape, Number.multiply(scale, scale))

/**
 * Gamma differential entropy:
 * k + ln(θ) + ln Γ(k) + (1−k)ψ(k).
 *
 * @since 0.1.0
 * @category internal
 */
export const gammaEntropy = (shape: number, scale: number): number =>
  Number.sum(
    Number.sum(shape, log(scale)),
    Number.sum(
      lnGamma(shape),
      Number.multiply(Number.subtract(1, shape), digamma(shape))
    )
  )
