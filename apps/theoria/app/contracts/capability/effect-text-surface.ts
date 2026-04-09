import { Schema } from "effect"

import { corpus } from "../corpus.js"

import { stageSliderMaxWidth } from "./effect-text.js"

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

export const EffectTextSurfaceControls = Schema.Struct({
  corpusIndex: NonNegativeInt,
  width: PositiveInt,
  obstaclesEnabled: Schema.Boolean
})

export type EffectTextSurfaceControls = typeof EffectTextSurfaceControls.Type

export const defaultEffectTextSurfaceControls: EffectTextSurfaceControls = EffectTextSurfaceControls.make({
  corpusIndex: 0,
  width: Math.round(stageSliderMaxWidth / 2),
  obstaclesEnabled: false
})

export const effectTextSurfaceControlsForCustomText = (
  customText: string
): EffectTextSurfaceControls =>
  EffectTextSurfaceControls.make({
    ...defaultEffectTextSurfaceControls,
    corpusIndex: customText.trim().length > 0 ? corpus.length : defaultEffectTextSurfaceControls.corpusIndex
  })
