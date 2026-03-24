/**
 * Thompson Sampling acquisition — Gumbel-noise perturbation of log-likelihood scores.
 *
 * @since 0.1.0
 */
import { Option } from "effect"

import * as Float64 from "../../../internal/float64.js"
import { scoreWithEstimatedCost } from "../../../internal/tpe/expectedImprovement.js"
import { type AcquisitionContext, AcquisitionImplementation } from "./model.js"

const ROLL_EPSILON = 1e-12

const clampRoll = (roll: number): number =>
  roll <= ROLL_EPSILON
    ? ROLL_EPSILON
    : roll >= 1 - ROLL_EPSILON
    ? 1 - ROLL_EPSILON
    : roll

const gumbelNoise = (roll: number): number =>
  -Float64.log(
    -Float64.log(clampRoll(roll))
  )

/** @since 0.1.0 */
export const thompsonScore = (
  logL: number,
  roll: Option.Option<number>,
  estimatedCost: Option.Option<number>
): number =>
  scoreWithEstimatedCost(
    Option.match(roll, {
      onNone: () => logL,
      onSome: (sampleRoll) => logL + gumbelNoise(sampleRoll)
    }),
    estimatedCost
  )

/** @since 0.1.0 */
export const thompsonAcquisition: AcquisitionImplementation = new AcquisitionImplementation({
  name: "thompson",
  score: ({ logL, estimatedCost, roll }: AcquisitionContext) => thompsonScore(logL, roll, estimatedCost)
})
