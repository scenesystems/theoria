import { signEntryDescriptor } from "../../../contracts/entry/descriptors/sign.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"

import { type EntryRegistrationOptions, materializeEntryDefinition } from "../../kernel/registration.js"
import { preloadProgram, run } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean => manifest === null

export const signEntryRegistration: EntryRegistrationOptions<"sign"> = {
  descriptor: signEntryDescriptor,
  lane: "local",
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan: null
}

export const signEntryDefinition = materializeEntryDefinition(signEntryRegistration)
