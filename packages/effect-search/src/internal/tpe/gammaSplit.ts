import { ceil } from "@scenesystems/effect-math/Numeric"
import { Boolean, Match, Number as Num, Schema } from "effect"

export const GammaValueSchema = Schema.NonNegative

export type GammaValue = Schema.Schema.Type<typeof GammaValueSchema>

const MAX_GAMMA = 25
const isNonNaN = Schema.is(Schema.NonNaN)

const boundedGamma = (value: number): GammaValue =>
  Num.clamp(value, {
    minimum: 0,
    maximum: MAX_GAMMA
  })

export const defaultGamma = (nCompletedTrials: number): GammaValue =>
  boundedGamma(ceil(Num.multiply(0.1, nCompletedTrials)))

export const hyperoptDefaultGamma = (nCompletedTrials: number): GammaValue =>
  Match.value(Boolean.and(isNonNaN(nCompletedTrials), Num.lessThanOrEqualTo(nCompletedTrials, 0))).pipe(
    Match.when(true, () => 0),
    Match.orElse(() => boundedGamma(ceil(Num.multiply(0.25, Math.sqrt(nCompletedTrials)))))
  )

export const hyperoptGamma = hyperoptDefaultGamma
