import { sealEntryDescriptor } from "../../../contracts/entry/descriptors/seal.js"
import type { StreamManifest } from "../../../contracts/evidence/manifest.js"

import { makeEntryRegistration } from "../../kernel/registration.js"
import { preloadProgram, run } from "./run.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean => manifest === null

export const sealEntryRegistration = makeEntryRegistration({
  descriptor: sealEntryDescriptor,
  lane: "local",
  execute: run,
  preloadProgram,
  acceptsManifest,
  streamPlan: null
})
