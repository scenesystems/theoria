import { Schema } from "effect"

import { effectSearchEntryDescriptor } from "../../../contracts/entry/descriptors/effect-search.js"
import { EffectSearchManifest, type StreamManifest } from "../../../contracts/evidence/manifest.js"

import { EntryDefinition, type EntryRegistrationOptions } from "../../kernel/registration.js"
import { preloadProgram, run, streamElements, streamPlan } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectSearchManifest)(manifest)

export const effectSearchEntryRegistration: EntryRegistrationOptions<"effect-search"> = {
  descriptor: effectSearchEntryDescriptor,
  lane: "local",
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan,
  streamElements
}

export const effectSearchEntryDefinition = EntryDefinition.make(effectSearchEntryRegistration)
