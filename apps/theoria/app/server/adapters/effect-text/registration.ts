import { Schema } from "effect"

import { effectTextEntryDescriptor } from "../../../contracts/entry/descriptors/effect-text.js"
import { EffectTextManifest, type StreamManifest } from "../../../contracts/evidence/manifest.js"

import { type EntryRegistrationOptions, materializeEntryDefinition } from "../../kernel/registration.js"
import { preloadProgram, run, streamElements, streamPlan } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectTextManifest)(manifest)

export const effectTextEntryRegistration: EntryRegistrationOptions<"effect-text"> = {
  descriptor: effectTextEntryDescriptor,
  lane: "local",
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan,
  streamElements
}

export const effectTextEntryDefinition = materializeEntryDefinition(effectTextEntryRegistration)
