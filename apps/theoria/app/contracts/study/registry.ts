import type { Schema } from "effect"
import { Data } from "effect"

import { type EntryId, workflowEntryId } from "../entry/id.js"
import { type StudyId, workflowStudyId } from "./id.js"
import { workflowStudyDescriptor } from "./workflow/descriptor.js"

const studyDescriptorTuple = [workflowStudyDescriptor]

export type AnyStudyDescriptor = (typeof studyDescriptorTuple)[number]

type StudyDescriptorByEntryId = {
  readonly [Id in EntryId]: Extract<AnyStudyDescriptor, { readonly entryId: Id }>
}

type StudyDescriptorByStudyId = {
  readonly [Id in StudyId]: Extract<AnyStudyDescriptor, { readonly studyId: Id }>
}

const studyDescriptorByEntryId: StudyDescriptorByEntryId = {
  [workflowEntryId]: workflowStudyDescriptor
}

const studyDescriptorByStudyId: StudyDescriptorByStudyId = {
  [workflowStudyId]: workflowStudyDescriptor
}

export const StudyDraft = workflowStudyDescriptor.draftSchema

export type StudyDraft = typeof StudyDraft.Type
export type WorkflowStudyDraft = Extract<StudyDraft, { readonly entryId: typeof workflowEntryId }>

export const StudyRunRequest = workflowStudyDescriptor.runRequestSchema

export type StudyRunRequest = typeof StudyRunRequest.Type

export class StudyRegistry extends Data.Class<StudyRegistry.Shape> {
  static make(shape: StudyRegistry.Shape): StudyRegistry {
    return new StudyRegistry(shape)
  }

  static current(): StudyRegistry {
    return currentStudyRegistry
  }

  descriptorForEntryId<Id extends EntryId>(entryId: Id): StudyDescriptorByEntryId[Id] {
    return this.descriptorByEntryId[entryId]
  }

  descriptorForStudyId<Id extends StudyId>(studyId: Id): StudyDescriptorByStudyId[Id] {
    return this.descriptorByStudyId[studyId]
  }

  defaultDraftForEntryId<Id extends EntryId>(entryId: Id): StudyDraft {
    return this.descriptorForEntryId(entryId).defaultDraft()
  }

  studyIdForEntryId<Id extends EntryId>(entryId: Id): StudyDescriptorByEntryId[Id]["studyId"] {
    return this.descriptorForEntryId(entryId).studyId
  }

  schemaForEntryId<Id extends EntryId>(entryId: Id): Schema.Schema<StudyDraft> {
    return this.descriptorForEntryId(entryId).draftSchema
  }
}

export namespace StudyRegistry {
  export interface Shape {
    readonly descriptors: ReadonlyArray<AnyStudyDescriptor>
    readonly descriptorByEntryId: StudyDescriptorByEntryId
    readonly descriptorByStudyId: StudyDescriptorByStudyId
  }
}

export const isWorkflowStudyDraft = (draft: StudyDraft): draft is WorkflowStudyDraft =>
  draft.entryId === workflowEntryId

const currentStudyRegistry = StudyRegistry.make({
  descriptors: studyDescriptorTuple,
  descriptorByEntryId: studyDescriptorByEntryId,
  descriptorByStudyId: studyDescriptorByStudyId
})
