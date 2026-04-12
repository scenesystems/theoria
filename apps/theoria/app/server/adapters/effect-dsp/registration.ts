import { Effect, Option, Schema } from "effect"

import { EntryCapabilityAvailability } from "../../../contracts/capability/availability.js"
import { effectDspEntryDescriptor } from "../../../contracts/entry/descriptors/effect-dsp.js"
import { EffectDspManifest, type StreamManifest } from "../../../contracts/evidence/manifest.js"

import { DspProviderRuntime } from "../../capability/effect-dsp.js"
import { EntryDefinition, type EntryRegistrationOptions } from "../../kernel/registration.js"
import { preloadProgram, run, streamElements, streamPlan } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectDspManifest)(manifest)

const capability = Effect.gen(function*() {
  const runtime = yield* DspProviderRuntime

  return EntryCapabilityAvailability.resolve({
    id: effectDspEntryDescriptor.entryId,
    enabled: runtime.capability.enabled,
    ...Option.match(runtime.capability.reason, {
      onNone: () => ({}),
      onSome: (reason) => ({ reason })
    })
  })
})

export const effectDspEntryRegistration: EntryRegistrationOptions<"effect-dsp"> = {
  descriptor: effectDspEntryDescriptor,
  lane: "provider",
  capability,
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan,
  streamElements
}

export const effectDspEntryDefinition = EntryDefinition.make(effectDspEntryRegistration)
