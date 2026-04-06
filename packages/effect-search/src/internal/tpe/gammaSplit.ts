import { Match, Number as Num, Schema } from "effect"
import { sqrt } from "effect-math/Numeric"

export const GammaValueSchema = Schema.NonNegative

export type GammaValue = Schema.Schema.Type<typeof GammaValueSchema>

const MAX_GAMMA = 25

const boundedGamma = (value: number): GammaValue =>
  Num.clamp(value, {
    minimum: 0,
    maximum: MAX_GAMMA
  })

export const defaultGamma = (nCompletedTrials: number): GammaValue => boundedGamma(Math.ceil(0.1 * nCompletedTrials))

export const hyperoptDefaultGamma = (nCompletedTrials: number): GammaValue =>
  Match.value(Num.lessThanOrEqualTo(nCompletedTrials, 0)).pipe(
    Match.when(true, () => 0),
    Match.orElse(() => boundedGamma(Math.ceil(0.25 * sqrt(nCompletedTrials))))
  )

export const hyperoptGamma = hyperoptDefaultGamma
