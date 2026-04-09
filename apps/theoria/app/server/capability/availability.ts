import { Effect, Option, Schema } from "effect"

import {
  CapabilityAvailability,
  type CapabilityAvailability as CapabilityAvailabilitySnapshot,
  type EntryCapabilityAvailability
} from "../../contracts/capability/availability.js"
import type { EntryId } from "../../contracts/entry/id.js"
import { visibleEntryDescriptorsForReleaseStage } from "../../contracts/entry/routing.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { lookup } from "../kernel/registry.js"

import { DspProviderRuntime, dspRuntimeProjection } from "./effect-dsp.js"

const pendingCapability = (id: EntryId): EntryCapabilityAvailability => ({
  id,
  enabled: false,
  reason: "Runtime registration has not shipped for this entry yet."
})

export const capabilityForEntryId = (
  id: EntryId
): Effect.Effect<EntryCapabilityAvailability, never, DspProviderRuntime> =>
  Option.match(lookup(id), {
    onNone: () => Effect.succeed(pendingCapability(id)),
    onSome: (definition) => definition.capability
  })

export const capabilityAvailability = (
  releaseStage: ReleaseStage
): Effect.Effect<CapabilityAvailabilitySnapshot, never, DspProviderRuntime> =>
  Effect.gen(function*() {
    const dspRuntime = yield* DspProviderRuntime
    const dsp = yield* dspRuntimeProjection(dspRuntime)
    const visibleEntries = visibleEntryDescriptorsForReleaseStage(releaseStage)
    const entryCapabilities = yield* Effect.forEach(visibleEntries, (descriptor) =>
      capabilityForEntryId(descriptor.entryId))

    return yield* Schema.decodeUnknown(CapabilityAvailability)({
      entries: entryCapabilities,
      dsp
    }).pipe(Effect.orDie)
  })
