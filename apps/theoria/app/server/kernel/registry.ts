import { Layer } from "effect"
import { Option } from "effect"

import { workflowEntryDescriptor } from "../../contracts/entry/descriptors/workflow.js"
import { type EntryId, isRunnableEntryId, type RunnableEntryId, runnableEntryIds } from "../../contracts/entry/id.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { workflowStudyDefinition } from "../study/workflow/study-definition.js"
import { StudyDefinition } from "./registration.js"

const definitionsById: Readonly<Record<RunnableEntryId, StudyDefinition>> = {
  workflow: StudyDefinition.make({
    descriptor: workflowEntryDescriptor,
    lane: "provider",
    preloadProgram: workflowStudyDefinition.preloadProgram,
    acceptsManifest: workflowStudyDefinition.acceptsManifest,
    streamPlan: workflowStudyDefinition.streamPlan
  })
}

type Definition = (typeof definitionsById)[RunnableEntryId]

const definitionForId = (id: RunnableEntryId): Definition => definitionsById[id]

const definitions: ReadonlyArray<Definition> = runnableEntryIds.map(definitionForId)

const [firstDefinition, ...restDefinitions] = definitions

export const StudyKernelLive = Option.match(Option.fromNullable(firstDefinition), {
  onNone: () => Layer.empty,
  onSome: (definition) =>
    restDefinitions.reduce(
      (layer, nextDefinition) => Layer.merge(layer, nextDefinition.executionLive),
      definition.executionLive
    )
})

export const lookup = (id: EntryId): Option.Option<Definition> =>
  isRunnableEntryId(id)
    ? Option.some(definitionForId(id))
    : Option.none()

export const lookupForReleaseStage = (id: EntryId, stage: ReleaseStage): Option.Option<Definition> =>
  lookup(id).pipe(
    Option.filter((definition) => stage === "preview" || definition.descriptor.releaseState === "published")
  )
