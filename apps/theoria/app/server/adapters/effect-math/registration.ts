import { Schema } from "effect"

import { effectMathEntryDescriptor } from "../../../contracts/entry/descriptors/effect-math.js"
import { EffectMathManifest, type StreamManifest } from "../../../contracts/evidence/manifest.js"

import { makeEntryRegistration } from "../../kernel/registration.js"
import { preloadProgram, run, streamElements, streamPlan } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectMathManifest)(manifest)

export const effectMathEntryRegistration = makeEntryRegistration({
  descriptor: effectMathEntryDescriptor,
  lane: "local",
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan,
  streamElements
})
