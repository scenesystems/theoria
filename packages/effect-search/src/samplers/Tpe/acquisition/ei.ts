import { expectedImprovementScore, scoreWithEstimatedCost } from "../../../internal/tpe/expectedImprovement.js"
import { type AcquisitionContext, AcquisitionImplementation } from "./model.js"

export const eiScore = ({
  logL,
  logG,
  estimatedCost
}: AcquisitionContext): number =>
  scoreWithEstimatedCost(
    expectedImprovementScore(logL, logG),
    estimatedCost
  )

export const eiAcquisition: AcquisitionImplementation = new AcquisitionImplementation({
  name: "ei",
  score: eiScore
})
