import { Schema } from "effect"
import * as InferenceContracts from "effect-inference/Contracts"

export const DspRuntimeProjection = Schema.Struct({
  enabled: Schema.Boolean,
  reason: Schema.optional(Schema.String),
  requestedRuntime: Schema.optional(InferenceContracts.DesiredRuntimeDescriptorSchema),
  resolvedRoute: Schema.optional(InferenceContracts.ResolvedRouteDescriptorSchema)
})

export type DspRuntimeProjection = typeof DspRuntimeProjection.Type
