import { Option, Schema } from "effect"

import { EntryId, type EntryId as EntryIdType } from "../entry/id.js"
import { FailureEnvelope, Metadata } from "../envelope.js"
import { DspRuntimeProjection } from "./effect-dsp-runtime-projection.js"

export const DspProvider = Schema.Literal("openai", "anthropic", "openrouter")

export type DspProvider = typeof DspProvider.Type

export class EntryCapabilityAvailability
  extends Schema.Class<EntryCapabilityAvailability>("EntryCapabilityAvailability")({
    id: EntryId,
    enabled: Schema.Boolean,
    reason: Schema.optional(Schema.String)
  })
{
  static enabled(id: EntryIdType): EntryCapabilityAvailability {
    return EntryCapabilityAvailability.make({ id, enabled: true })
  }

  static pending(
    id: EntryIdType,
    reason = "Runtime registration has not shipped for this entry yet."
  ): EntryCapabilityAvailability {
    return EntryCapabilityAvailability.make({
      id,
      enabled: false,
      reason
    })
  }

  static resolve({
    enabled,
    id,
    reason
  }: {
    readonly enabled: boolean
    readonly id: EntryIdType
    readonly reason?: string
  }): EntryCapabilityAvailability {
    return enabled
      ? EntryCapabilityAvailability.enabled(id)
      : EntryCapabilityAvailability.make({
        id,
        enabled,
        reason
      })
  }
}

export class CapabilityAvailability extends Schema.Class<CapabilityAvailability>("CapabilityAvailability")({
  entries: Schema.Array(EntryCapabilityAvailability),
  dsp: DspRuntimeProjection
}) {
  entry(id: EntryIdType): Option.Option<EntryCapabilityAvailability> {
    return Option.fromNullable(this.entries.find((entry) => entry.id === id))
  }
}

export class CapabilityAvailabilityRoute extends Schema.TaggedClass<CapabilityAvailabilityRoute>()("availability", {}) {
  static availability(): CapabilityAvailabilityRoute {
    return capabilityAvailabilityRoute
  }

  static fromPathname(pathname: string): Option.Option<CapabilityAvailabilityRoute> {
    return pathname === CapabilityAvailabilityRoute.pathname()
      ? Option.some(CapabilityAvailabilityRoute.availability())
      : Option.none()
  }

  static matches(pathname: string): boolean {
    return Option.isSome(CapabilityAvailabilityRoute.fromPathname(pathname))
  }

  static pathname(): string {
    return "/api/availability"
  }

  path(): string {
    return CapabilityAvailabilityRoute.pathname()
  }
}

export class CapabilityAvailabilitySuccessEnvelope extends Schema.Class<CapabilityAvailabilitySuccessEnvelope>(
  "CapabilityAvailabilitySuccessEnvelope"
)({
  ok: Schema.Literal(true),
  meta: Metadata,
  data: CapabilityAvailability
}) {
  static ok(meta: Metadata, data: CapabilityAvailability): CapabilityAvailabilitySuccessEnvelope {
    return CapabilityAvailabilitySuccessEnvelope.make({ ok: true, meta, data })
  }
}

export const CapabilityAvailabilityEnvelope = Schema.Union(CapabilityAvailabilitySuccessEnvelope, FailureEnvelope)

export type CapabilityAvailabilityEnvelope = typeof CapabilityAvailabilityEnvelope.Type

const capabilityAvailabilityRoute = CapabilityAvailabilityRoute.make({})
