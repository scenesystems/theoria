/**
 * Ridder-style extrapolation kernels for limit-accurate numerical differentiation.
 *
 * @since 0.1.0
 * @category internal
 */

export { ridderExtrapolation } from "./ridder/core.js"
export { derivativeLimitRidder, secondDerivativeLimitRidder } from "./ridder/univariate.js"
