import { Schema } from "effect"

import { DspRuntimeProjection } from "./capability/effect-dsp-runtime-projection.js"
import { FailureEnvelope, Metadata } from "./envelope.js"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export const HealthLivePathname = "/api/health/live"
export const HealthReadyPathname = "/api/health/ready"

export class Live extends Schema.Class<Live>("Live")({
  status: Schema.Literal("live")
}) {}

export class LiveSuccessEnvelope extends Schema.Class<LiveSuccessEnvelope>("LiveSuccessEnvelope")({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: Live
}) {}

export const LiveEnvelope = Schema.Union(LiveSuccessEnvelope, FailureEnvelope)

export class Ready extends Schema.Class<Ready>("Ready")({
  status: Schema.Literal("ready"),
  uptimeMs: NonNegativeNumber,
  dsp: DspRuntimeProjection
}) {}

export class ReadySuccessEnvelope extends Schema.Class<ReadySuccessEnvelope>("ReadySuccessEnvelope")({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: Ready
}) {}

export const ReadyEnvelope = Schema.Union(ReadySuccessEnvelope, FailureEnvelope)
