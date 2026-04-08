import { Schema } from "effect"

import { EntryId } from "../entry/id.js"
import { DspRuntimeProjection } from "./effect-dsp-runtime-projection.js"

export const DspProvider = Schema.Literal("openai", "anthropic", "openrouter")

export type DspProvider = typeof DspProvider.Type

export const DemoCapability = Schema.Struct({
  id: EntryId,
  enabled: Schema.Boolean,
  reason: Schema.optional(Schema.String)
})

export type DemoCapability = typeof DemoCapability.Type

export const Capabilities = Schema.Struct({
  demos: Schema.Array(DemoCapability),
  dsp: DspRuntimeProjection
})

export type Capabilities = typeof Capabilities.Type
