import { Schema } from "effect"
import { DspRuntimeProjection } from "./dsp-runtime-projection.js"
import { Envelope } from "./envelope.js"
import { Id } from "./id.js"

export { DspProvider } from "./dsp-runtime-projection.js"

export const DemoCapability = Schema.Struct({
  id: Id,
  enabled: Schema.Boolean,
  reason: Schema.optional(Schema.String)
})

export type DemoCapability = typeof DemoCapability.Type

export const Capabilities = Schema.Struct({
  demos: Schema.Array(DemoCapability),
  dsp: DspRuntimeProjection
})

export type Capabilities = typeof Capabilities.Type

export const CapabilitiesEnvelope = Envelope(Capabilities)
