/**
 * Probability of Improvement acquisition — PI scoring from log-density ratios.
 *
 * @since 0.1.0
 */
import type { Option } from "effect"
import { exp } from "effect-math/Numeric"

import { scoreWithEstimatedCost } from "../../../internal/tpe/expectedImprovement.js"
import { type AcquisitionContext, AcquisitionImplementation } from "./model.js"

const probabilityFromLogDensities = (
  logL: number,
  logG: number
): number => exp(logL - logG) / (1 + exp(logL - logG))

/**
 * Computes the Probability of Improvement from log-densities ℓ(x)
 * and g(x), optionally weighted by estimated cost. PI measures the
 * probability that a candidate improves over the current best,
 * making it more exploitation-focused than EI.
 *
 * @see {@link AcquisitionContext} for the log-density and cost inputs
 * @see {@link piAcquisition} for the pre-built strategy instance
 * @since 0.1.0
 * @category scoring
 */
export const piScore = (
  logL: number,
  logG: number,
  estimatedCost: Option.Option<number>
): number =>
  scoreWithEstimatedCost(
    probabilityFromLogDensities(logL, logG),
    estimatedCost
  )

/**
 * Pre-built Probability of Improvement acquisition strategy instance,
 * ready for registration in the TPE sampler's acquisition registry.
 * Uses {@link piScore} as its scoring function.
 *
 * @see {@link piScore} for the underlying scoring computation
 * @see {@link AcquisitionImplementation} for the strategy protocol
 * @since 0.1.0
 * @category constructors
 */
export const piAcquisition: AcquisitionImplementation = new AcquisitionImplementation({
  name: "pi",
  score: ({ logL, logG, estimatedCost }: AcquisitionContext) => piScore(logL, logG, estimatedCost)
})
