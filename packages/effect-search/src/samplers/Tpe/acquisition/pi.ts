/**
 * Probability of Improvement acquisition — PI scoring from log-density ratios.
 *
 * @since 0.1.0
 */
import type { Option } from "effect"

import * as Float64 from "../../../internal/float64.js"
import { scoreWithEstimatedCost } from "../../../internal/tpe/expectedImprovement.js"
import { type AcquisitionContext, AcquisitionImplementation } from "./model.js"

const probabilityFromLogDensities = (
  logL: number,
  logG: number
): number => Float64.exp(logL - logG) / (1 + Float64.exp(logL - logG))

/** @since 0.1.0 */
export const piScore = (
  logL: number,
  logG: number,
  estimatedCost: Option.Option<number>
): number =>
  scoreWithEstimatedCost(
    probabilityFromLogDensities(logL, logG),
    estimatedCost
  )

/** @since 0.1.0 */
export const piAcquisition: AcquisitionImplementation = new AcquisitionImplementation({
  name: "pi",
  score: ({ logL, logG, estimatedCost }: AcquisitionContext) => piScore(logL, logG, estimatedCost)
})
