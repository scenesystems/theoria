import { Option, Schema } from "effect"

import { EntryId, type EntryId as EntryIdType } from "../entry/id.js"
import { FailureEnvelope, Metadata } from "../envelope.js"
import { DspRuntimeProjection } from "./effect-dsp-runtime-projection.js"

export const CapabilityAvailabilityPathname = "/api/availability"

export const DspProvider = Schema.Literal("openai", "anthropic", "openrouter")

export type DspProvider = typeof DspProvider.Type

export const EntryCapabilityAvailability = Schema.Struct({
  id: EntryId,
  enabled: Schema.Boolean,
  reason: Schema.optional(Schema.String)
})

export type EntryCapabilityAvailability = typeof EntryCapabilityAvailability.Type

export const CapabilityAvailability = Schema.Struct({
  entries: Schema.Array(EntryCapabilityAvailability),
  dsp: DspRuntimeProjection
})

export type CapabilityAvailability = typeof CapabilityAvailability.Type

export const entryCapabilityAvailabilityFor = (
  snapshot: CapabilityAvailability,
  id: EntryIdType
): Option.Option<EntryCapabilityAvailability> => Option.fromNullable(snapshot.entries.find((entry) => entry.id === id))

export class CapabilityAvailabilitySuccessEnvelope extends Schema.Class<CapabilityAvailabilitySuccessEnvelope>(
  "CapabilityAvailabilitySuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: CapabilityAvailability
}) {}

export const CapabilityAvailabilityEnvelope = Schema.Union(CapabilityAvailabilitySuccessEnvelope, FailureEnvelope)

export type CapabilityAvailabilityEnvelope = typeof CapabilityAvailabilityEnvelope.Type
