import type { PackageName } from "@theoria/source-proof/contracts"
import { Data, Effect, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import type { ReleaseStage } from "../release-stage.js"

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

const entryDescriptorTuple = [
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

type EntryDescriptorById = {
  readonly [Id in EntryId]: Extract<AnyEntryDescriptor, { readonly entryId: Id }>
}

const entryDescriptorById: EntryDescriptorById = {
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

export class EntryRegistry extends Data.Class<EntryRegistry.Shape> {
  static make(shape: EntryRegistry.Shape): EntryRegistry {
    return new EntryRegistry(shape)
  }

  static current(): EntryRegistry {
    return currentEntryRegistry
  }

  descriptorForId<Id extends EntryId>(entryId: Id): EntryDescriptorById[Id] {
    return this.descriptorById[entryId]
  }

  descriptorForPackageName(packageName: PackageName): Option.Option<AnyEntryDescriptor> {
    return Arr.findFirst(this.descriptors, (descriptor) => descriptor.packageName === packageName)
  }

  descriptorForPath(pathname: string): Option.Option<AnyEntryDescriptor> {
    return Arr.findFirst(this.descriptors, (descriptor) => descriptor.path === pathname)
  }

  entryIdForPackageName(packageName: PackageName): Option.Option<EntryId> {
    return this.descriptorForPackageName(packageName).pipe(Option.map((descriptor) => descriptor.entryId))
  }

  entryIdForPath(pathname: string): Option.Option<EntryId> {
    return this.descriptorForPath(pathname).pipe(Option.map((descriptor) => descriptor.entryId))
  }

  visibleDescriptorForPath(pathname: string, stage: ReleaseStage): Option.Option<AnyEntryDescriptor> {
    return this.descriptorForPath(pathname).pipe(
      Option.filter((descriptor) => descriptor.visibleInReleaseStage(stage))
    )
  }

  visibleDescriptorsForReleaseStage(stage: ReleaseStage): ReadonlyArray<AnyEntryDescriptor> {
    return Arr.filter(this.descriptors, (descriptor) => descriptor.visibleInReleaseStage(stage))
  }

  visibleEntryIdsForReleaseStage(stage: ReleaseStage): ReadonlyArray<EntryId> {
    return Arr.map(this.visibleDescriptorsForReleaseStage(stage), (descriptor) => descriptor.entryId)
  }

  visiblePackageDocsPackageIdsForReleaseStage(stage: ReleaseStage): ReadonlyArray<PackageName> {
    return Arr.map(this.visibleDescriptorsForReleaseStage(stage), (descriptor) => descriptor.packageName)
  }

  fingerprint(): Effect.Effect<DurableFingerprint, never, never> {
    return Effect.forEach(this.descriptors, (descriptor) => descriptor.fingerprint()).pipe(
      Effect.flatMap(fingerprintOf)
    )
  }
}

export namespace EntryRegistry {
  export interface Shape {
    readonly descriptors: ReadonlyArray<AnyEntryDescriptor>
    readonly descriptorById: EntryDescriptorById
  }
}

export const isWorkflowEntryDraft = (draft: EntryDraft): draft is WorkflowEntryDraft =>
  draft.entryId === workflowEntryId

const currentEntryRegistry = EntryRegistry.make({
  descriptors: entryDescriptorTuple,
  descriptorById: entryDescriptorById
})
