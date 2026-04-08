import { Schema } from "effect"
import { DspRuntimeProjection } from "./capability/effect-dsp-runtime-projection.js"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export const Live = Schema.Struct({
  status: Schema.Literal("live")
})

export type Live = typeof Live.Type

export const Ready = Schema.Struct({
  status: Schema.Literal("ready"),
  uptimeMs: NonNegativeNumber,
  dsp: DspRuntimeProjection
})

export type Ready = typeof Ready.Type
