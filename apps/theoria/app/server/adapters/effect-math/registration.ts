import { Schema } from "effect"

import { effectMathEntryDescriptor } from "../../../contracts/entry/descriptors/effect-math.js"
import { EffectMathManifest, type StreamManifest } from "../../../contracts/evidence/manifest.js"

import { type EntryRegistrationOptions, materializeEntryDefinition } from "../../kernel/registration.js"
import { preloadProgram, run, streamElements, streamPlan } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectMathManifest)(manifest)

export const effectMathEntryRegistration: EntryRegistrationOptions<"effect-math"> = {
  descriptor: effectMathEntryDescriptor,
  lane: "local",
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan,
  streamElements
}

export const effectMathEntryDefinition = materializeEntryDefinition(effectMathEntryRegistration)
