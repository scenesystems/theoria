/**
 * Ridder derivatives for univariate functions.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number } from "effect"

import type { DerivativeLimitEstimate, RidderMethodInputType } from "../../schema.js"
import { ridderExtrapolation } from "./core.js"

/**
 * Limit-accurate first derivative estimate by Ridder extrapolation.
 *
 * @since 0.1.0
 * @category internal
 */
export const derivativeLimitRidder = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): DerivativeLimitEstimate =>
  ridderExtrapolation(
    (step) =>
      Number.unsafeDivide(
        Number.subtract(f(Number.sum(x, step)), f(Number.subtract(x, step))),
        Number.multiply(2, step)
      ),
    config
  )

/**
 * Limit-accurate second derivative estimate by Ridder extrapolation.
 *
 * @since 0.1.0
 * @category internal
 */
export const secondDerivativeLimitRidder = (
  f: (x: number) => number,
  x: number,
  config?: RidderMethodInputType
): DerivativeLimitEstimate => {
  const center = f(x)

  return ridderExtrapolation((step) => {
    const forward = f(Number.sum(x, step))
    const backward = f(Number.subtract(x, step))

    return Number.unsafeDivide(
      Number.sum(Number.subtract(forward, Number.multiply(2, center)), backward),
      Number.multiply(step, step)
    )
  }, config)
}
