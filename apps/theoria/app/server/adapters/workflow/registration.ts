import { Schema } from "effect"

import { workflowEntryDescriptor } from "../../../contracts/entry/descriptors/workflow.js"
import { type StreamManifest, WorkflowManifest } from "../../../contracts/evidence/manifest.js"

import { type EntryRegistrationOptions, materializeEntryDefinition } from "../../kernel/registration.js"
import { preloadProgram, streamPlan } from "./stream.js"

const acceptsManifest = (manifest: StreamManifest | null): boolean =>
  manifest !== null && Schema.is(WorkflowManifest)(manifest)

export const workflowEntryRegistration: EntryRegistrationOptions<"workflow"> = {
  descriptor: workflowEntryDescriptor,
  lane: "provider",
  preloadProgram,
  acceptsManifest,
  streamPlan
}

export const workflowEntryDefinition = materializeEntryDefinition(workflowEntryRegistration)
