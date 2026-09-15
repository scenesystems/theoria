/**
 * Thompson Sampling acquisition — Gumbel-noise perturbation of log-likelihood scores.
 *
 * @since 0.1.0
 */
import { Boolean, Match, Number as Num, Option, Schema } from "effect"

import * as Float64 from "../../../internal/float64.js"
import { scoreWithEstimatedCost } from "../../../internal/tpe/expectedImprovement.js"
import { type AcquisitionContext, AcquisitionImplementation } from "./model.js"

const ROLL_EPSILON = 1e-12
const isNonNaN = Schema.is(Schema.NonNaN)

const clampRoll = (roll: number): number =>
  Match.value(roll).pipe(
    Match.when((value) => Boolean.not(isNonNaN(value)), (value) => value),
    Match.when(Num.lessThanOrEqualTo(ROLL_EPSILON), () => ROLL_EPSILON),
    Match.when(Num.greaterThanOrEqualTo(Num.subtract(1, ROLL_EPSILON)), () => Num.subtract(1, ROLL_EPSILON)),
    Match.orElse((value) => value)
  )

const gumbelNoise = (roll: number): number =>
  Num.negate(Float64.log(
    Num.negate(Float64.log(clampRoll(roll)))
  ))

/**
 * Computes a Thompson Sampling score by perturbing the log-likelihood
 * with Gumbel noise drawn from the provided random roll, optionally
 * weighted by estimated cost. Thompson sampling provides a
 * theoretically grounded exploration strategy that naturally balances
 * exploitation and exploration through posterior sampling.
 *
 * @see {@link AcquisitionContext} for the log-density and roll inputs
 * @see {@link thompsonAcquisition} for the pre-built strategy instance
 * @since 0.1.0
 * @category scoring
 */
export const thompsonScore = (
  logL: number,
  roll: Option.Option<number>,
  estimatedCost: Option.Option<number>
): number =>
  scoreWithEstimatedCost(
    Option.match(roll, {
      onNone: () => logL,
      onSome: (sampleRoll) => Num.sum(logL, gumbelNoise(sampleRoll))
    }),
    estimatedCost
  )

/**
 * Pre-built Thompson Sampling acquisition strategy instance,
 * ready for registration in the TPE sampler's acquisition registry.
 * Uses {@link thompsonScore} as its scoring function.
 *
 * @see {@link thompsonScore} for the underlying Gumbel-noise computation
 * @see {@link AcquisitionImplementation} for the strategy protocol
 * @since 0.1.0
 * @category constructors
 */
export const thompsonAcquisition: AcquisitionImplementation = new AcquisitionImplementation({
  name: "thompson",
  score: ({ logL, estimatedCost, roll }: AcquisitionContext) => thompsonScore(logL, roll, estimatedCost)
})
