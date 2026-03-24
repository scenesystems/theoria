/**
 * Beta function kernel via the log-gamma identity.
 *
 * B(a, b) = exp(lnΓ(a) + lnΓ(b) − lnΓ(a + b))
 *
 * Uses the log-space form to avoid overflow for large arguments.
 *
 * @since 0.1.0
 * @category internal
 */
import { Number as N } from "effect"

import { lnGammaLanczos } from "./gamma.js"

/**
 * B(a, b) via exp(lnΓ(a) + lnΓ(b) − lnΓ(a + b)). Requires a > 0, b > 0.
 *
 * @since 0.1.0
 * @category internal
 */
export const betaFromGamma = (a: number, b: number): number =>
  Math.exp(N.subtract(N.sum(lnGammaLanczos(a), lnGammaLanczos(b)), lnGammaLanczos(N.sum(a, b))))
