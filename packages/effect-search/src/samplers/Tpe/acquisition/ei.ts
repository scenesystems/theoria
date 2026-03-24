/**
 * Expected Improvement acquisition — classic EI scoring with optional cost weighting.
 *
 * @since 0.1.0
 */
import { expectedImprovementScore, scoreWithEstimatedCost } from "../../../internal/tpe/expectedImprovement.js"
import { type AcquisitionContext, AcquisitionImplementation } from "./model.js"

/**
 * Computes the Expected Improvement score from the log-density ratio
 * ℓ(x)/g(x), optionally weighted by estimated cost. EI balances
 * exploitation of known good regions against exploration of uncertain
 * ones — the workhorse acquisition function for most TPE searches.
 *
 * @see {@link AcquisitionContext} for the log-density and cost inputs
 * @see {@link eiAcquisition} for the pre-built strategy instance
 * @since 0.1.0
 * @category scoring
 */
export const eiScore = ({
  logL,
  logG,
  estimatedCost
}: AcquisitionContext): number =>
  scoreWithEstimatedCost(
    expectedImprovementScore(logL, logG),
    estimatedCost
  )

/**
 * Pre-built Expected Improvement acquisition strategy instance,
 * ready for registration in the TPE sampler's acquisition registry.
 * Uses {@link eiScore} as its scoring function.
 *
 * @see {@link eiScore} for the underlying scoring computation
 * @see {@link AcquisitionImplementation} for the strategy protocol
 * @since 0.1.0
 * @category constructors
 */
export const eiAcquisition: AcquisitionImplementation = new AcquisitionImplementation({
  name: "ei",
  score: eiScore
})
