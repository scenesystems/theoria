/**
 * Ridder derivatives for univariate functions.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

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
    (step) => N.unsafeDivide(N.subtract(f(N.sum(x, step)), f(N.subtract(x, step))), N.multiply(2, step)),
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
    const forward = f(N.sum(x, step))
    const backward = f(N.subtract(x, step))

    return N.unsafeDivide(
      N.sum(N.subtract(forward, N.multiply(2, center)), backward),
      N.multiply(step, step)
    )
  }, config)
}
