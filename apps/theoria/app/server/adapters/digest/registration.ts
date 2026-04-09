import { digestEntryDescriptor } from "../../../contracts/entry/descriptors/digest.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"

import { type EntryRegistrationOptions, materializeEntryDefinition } from "../../kernel/registration.js"
import { preloadProgram, run } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean => manifest === null

export const digestEntryRegistration: EntryRegistrationOptions<"digest"> = {
  descriptor: digestEntryDescriptor,
  lane: "local",
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan: null
}

export const digestEntryDefinition = materializeEntryDefinition(digestEntryRegistration)
