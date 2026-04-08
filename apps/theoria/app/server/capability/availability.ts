import { Effect, Schema } from "effect"
import * as Arr from "effect/Array"

import { Capabilities, type Capabilities as CapabilityAvailability } from "../../contracts/capability/availability.js"
import { entryDescriptors } from "../../contracts/entry/registry.js"
import { entryVisibleInReleaseStage } from "../../contracts/entry/routing.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { capabilityForId } from "../kernel/registry.js"

import { DspProviderRuntime, dspRuntimeProjection } from "./effect-dsp.js"

export const capabilityAvailability = (
  releaseStage: ReleaseStage
): Effect.Effect<CapabilityAvailability, never, DspProviderRuntime> =>
  Effect.gen(function*() {
    const dspRuntime = yield* DspProviderRuntime
    const dsp = yield* dspRuntimeProjection(dspRuntime)
    const visibleEntries = Arr.filter(entryDescriptors, (descriptor) =>
      entryVisibleInReleaseStage(descriptor, releaseStage))
    const demos = yield* Effect.forEach(visibleEntries, (descriptor) =>
      capabilityForId(descriptor.entryId))

    return yield* Schema.decodeUnknown(Capabilities)({ demos, dsp }).pipe(Effect.orDie)
  })
