import { sealEntryDescriptor } from "../../../contracts/entry/descriptors/seal.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"

import { EntryDefinition, type EntryRegistrationOptions } from "../../kernel/registration.js"
import { preloadProgram, run } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean => manifest === null

export const sealEntryRegistration: EntryRegistrationOptions<"seal"> = {
  descriptor: sealEntryDescriptor,
  lane: "local",
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan: null
}

export const sealEntryDefinition = EntryDefinition.make(sealEntryRegistration)
