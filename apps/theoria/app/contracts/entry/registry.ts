import type { PackageName } from "@theoria/source-proof/contracts"
import { Effect, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { entryDescriptorFingerprint, type EntryDescriptorFingerprintOwner } from "./descriptor.js"
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
import { type EntryId, workflowEntryId } from "./id.js"

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

type EntryDescriptorById = {
  readonly [Id in EntryId]: Extract<AnyEntryDescriptor, { readonly entryId: Id }>
}

export const entryDescriptorById: EntryDescriptorById = {
  "effect-math": effectMathEntryDescriptor,
  "effect-search": effectSearchEntryDescriptor,
  "effect-dsp": effectDspEntryDescriptor,
  "effect-text": effectTextEntryDescriptor,
  "effect-inference": effectInferenceEntryDescriptor,
  digest: digestEntryDescriptor,
  seal: sealEntryDescriptor,
  sign: signEntryDescriptor,
  [workflowEntryId]: workflowEntryDescriptor
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
export type WorkflowEntryDraft = Extract<EntryDraft, { readonly entryId: typeof workflowEntryId }>

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

export const entryDescriptorForId = <Id extends EntryId>(entryId: Id): EntryDescriptorById[Id] =>
  entryDescriptorById[entryId]

export const entryDescriptorForPackageName = (packageName: PackageName): Option.Option<AnyEntryDescriptor> =>
  Arr.findFirst(entryDescriptors, (descriptor) => descriptor.packageName === packageName)

export const entryIdForPackageName = (packageName: PackageName): Option.Option<EntryId> =>
  entryDescriptorForPackageName(packageName).pipe(Option.map((descriptor) => descriptor.entryId))

export const isWorkflowEntryDraft = (draft: EntryDraft): draft is WorkflowEntryDraft =>
  draft.entryId === workflowEntryId

export const entryRegistryFingerprint = (
  registry: ReadonlyArray<EntryDescriptorFingerprintOwner>
): Effect.Effect<DurableFingerprint, never, never> =>
  Effect.forEach(registry, entryDescriptorFingerprint).pipe(Effect.flatMap(fingerprintOf))
