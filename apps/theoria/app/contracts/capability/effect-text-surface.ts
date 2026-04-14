import { Schema } from "effect"

import { corpus } from "../corpus.js"

import { stageSliderMaxWidth } from "./effect-text.js"

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const PositiveInt = Schema.Number.pipe(Schema.int(), Schema.greaterThan(0))

export class EffectTextSurfaceControls extends Schema.Class<EffectTextSurfaceControls>("EffectTextSurfaceControls")({
  corpusIndex: NonNegativeInt,
  width: PositiveInt,
  obstaclesEnabled: Schema.Boolean
}) {
  static defaults(): EffectTextSurfaceControls {
    return EffectTextSurfaceControls.make({
      corpusIndex: 0,
      width: Math.round(stageSliderMaxWidth / 2),
      obstaclesEnabled: false
    })
  }

  static fromCustomText(customText: string): EffectTextSurfaceControls {
    const defaults = EffectTextSurfaceControls.defaults()

    return EffectTextSurfaceControls.make({
      ...defaults,
      corpusIndex: customText.trim().length > 0 ? corpus.length : defaults.corpusIndex
    })
  }
}
