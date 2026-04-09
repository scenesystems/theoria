import { Schema } from "effect"

import { FailureEnvelope, Metadata } from "./envelope.js"

const NonNegativeNumber = Schema.Number.pipe(
  Schema.finite(),
  Schema.greaterThanOrEqualTo(0)
)

export const VersionPathname = "/api/version"

export class Version extends Schema.Class<Version>("Version")({
  service: Schema.Literal("theoria"),
  buildSha: Schema.String,
  startedAtMs: NonNegativeNumber
}) {}

export class VersionSuccessEnvelope extends Schema.Class<VersionSuccessEnvelope>("VersionSuccessEnvelope")({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: Version
}) {}

export const VersionEnvelope = Schema.Union(VersionSuccessEnvelope, FailureEnvelope)
