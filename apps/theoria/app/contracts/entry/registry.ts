import { Effect, Schema } from "effect"

import { type EntryDescriptor, entryDescriptorFingerprint } from "./descriptor.js"
import { digestEntryDescriptor } from "./descriptors/digest.js"
import { effectDspEntryDescriptor } from "./descriptors/effect-dsp.js"
import { effectInferenceEntryDescriptor } from "./descriptors/effect-inference.js"
import { effectMathEntryDescriptor } from "./descriptors/effect-math.js"
import { effectSearchEntryDescriptor } from "./descriptors/effect-search.js"
import { effectTextEntryDescriptor } from "./descriptors/effect-text.js"
import { sealEntryDescriptor } from "./descriptors/seal.js"
import { signEntryDescriptor } from "./descriptors/sign.js"
import { workflowEntryDescriptor } from "./descriptors/workflow.js"
import { type DurableFingerprint, fingerprintOf } from "./fingerprint.js"
import type { EntryId } from "./id.js"

export const entryDescriptorTuple = [
  effectMathEntryDescriptor,
  effectSearchEntryDescriptor,
  effectDspEntryDescriptor,
  effectTextEntryDescriptor,
  effectInferenceEntryDescriptor,
  digestEntryDescriptor,
  sealEntryDescriptor,
  signEntryDescriptor,
  workflowEntryDescriptor
]

export type AnyEntryDescriptor = (typeof entryDescriptorTuple)[number]

export const entryDescriptors: ReadonlyArray<AnyEntryDescriptor> = entryDescriptorTuple

export const entryDescriptorById: Readonly<Record<EntryId, AnyEntryDescriptor>> = {
  "effect-math": effectMathEntryDescriptor,
  "effect-search": effectSearchEntryDescriptor,
  "effect-dsp": effectDspEntryDescriptor,
  "effect-text": effectTextEntryDescriptor,
  "effect-inference": effectInferenceEntryDescriptor,
  digest: digestEntryDescriptor,
  seal: sealEntryDescriptor,
  sign: signEntryDescriptor,
  workflow: workflowEntryDescriptor
}

export const EntryDraft = Schema.Union(
  effectMathEntryDescriptor.draftSchema,
  effectSearchEntryDescriptor.draftSchema,
  effectDspEntryDescriptor.draftSchema,
  effectTextEntryDescriptor.draftSchema,
  effectInferenceEntryDescriptor.draftSchema,
  digestEntryDescriptor.draftSchema,
  sealEntryDescriptor.draftSchema,
  signEntryDescriptor.draftSchema,
  workflowEntryDescriptor.draftSchema
)

export type EntryDraft = typeof EntryDraft.Type

export const EntryRunRequest = Schema.Union(
  effectMathEntryDescriptor.runRequestSchema,
  effectSearchEntryDescriptor.runRequestSchema,
  effectDspEntryDescriptor.runRequestSchema,
  effectTextEntryDescriptor.runRequestSchema,
  effectInferenceEntryDescriptor.runRequestSchema,
  digestEntryDescriptor.runRequestSchema,
  sealEntryDescriptor.runRequestSchema,
  signEntryDescriptor.runRequestSchema,
  workflowEntryDescriptor.runRequestSchema
)

export type EntryRunRequest = typeof EntryRunRequest.Type

export const entryDescriptorForId = (entryId: EntryId): AnyEntryDescriptor => entryDescriptorById[entryId]

export const entryRegistryFingerprint = (
  registry: ReadonlyArray<EntryDescriptor<unknown, unknown, unknown, unknown>>
): Effect.Effect<DurableFingerprint, never, never> =>
  Effect.forEach(registry, entryDescriptorFingerprint).pipe(Effect.flatMap(fingerprintOf))
