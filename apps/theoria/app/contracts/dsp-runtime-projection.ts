import { Schema } from "effect"

export const DspProvider = Schema.Literal("openai", "anthropic", "openrouter")

export type DspProvider = typeof DspProvider.Type

export const DspRuntimeStatus = Schema.Literal(
  "unavailable",
  "configured",
  "operational",
  "degraded"
)

export type DspRuntimeStatus = typeof DspRuntimeStatus.Type

export const DspRuntimeReason = Schema.Literal(
  "provider-configuration-invalid",
  "provider-request-failed"
)

export type DspRuntimeReason = typeof DspRuntimeReason.Type

export const DspRuntimeProjection = Schema.Struct({
  status: DspRuntimeStatus,
  provider: Schema.optional(DspProvider),
  model: Schema.optional(Schema.String),
  reason: Schema.optional(DspRuntimeReason)
})

export type DspRuntimeProjection = typeof DspRuntimeProjection.Type
