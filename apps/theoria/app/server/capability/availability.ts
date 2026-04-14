import { Effect, Option } from "effect"

import {
  CapabilityAvailability,
  type CapabilityAvailability as CapabilityAvailabilitySnapshot,
  EntryCapabilityAvailability
} from "../../contracts/capability/availability.js"
import type { EntryId } from "../../contracts/entry/id.js"
import { EntryRegistry } from "../../contracts/entry/registry.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { lookup } from "../kernel/registry.js"

import { DspProviderRuntime, dspRuntimeProjection } from "./effect-dsp.js"

const entryRegistry = EntryRegistry.current()

export const capabilityForEntryId = (
  id: EntryId
): Effect.Effect<EntryCapabilityAvailability, never, DspProviderRuntime> =>
  Option.match(lookup(id), {
    onNone: () => Effect.succeed(EntryCapabilityAvailability.pending(id)),
    onSome: (definition) => definition.capability
  })

export const capabilityAvailability = (
  releaseStage: ReleaseStage
): Effect.Effect<CapabilityAvailabilitySnapshot, never, DspProviderRuntime> =>
  Effect.gen(function*() {
    const dspRuntime = yield* DspProviderRuntime
    const dsp = yield* dspRuntimeProjection(dspRuntime)
    const visibleEntries = entryRegistry.visibleDescriptorsForReleaseStage(releaseStage)
    const entryCapabilities = yield* Effect.forEach(visibleEntries, (descriptor) =>
      capabilityForEntryId(descriptor.entryId))

    return CapabilityAvailability.make({
      entries: entryCapabilities,
      dsp
    })
  })
