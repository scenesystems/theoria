/**
 * Expected Improvement acquisition — classic EI scoring with optional cost weighting.
 *
 * @since 0.1.0
 */
import { expectedImprovementScore, scoreWithEstimatedCost } from "../../../internal/tpe/expectedImprovement.js"
import { type AcquisitionContext, AcquisitionImplementation } from "./model.js"

/** @since 0.1.0 */
export const eiScore = ({
  logL,
  logG,
  estimatedCost
}: AcquisitionContext): number =>
  scoreWithEstimatedCost(
    expectedImprovementScore(logL, logG),
    estimatedCost
  )

/** @since 0.1.0 */
export const eiAcquisition: AcquisitionImplementation = new AcquisitionImplementation({
  name: "ei",
  score: eiScore
})
