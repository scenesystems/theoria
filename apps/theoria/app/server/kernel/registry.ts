import { Layer } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import { type EntryId, isRunnableEntryId, type RunnableEntryId, runnableEntryIds } from "../../contracts/entry/id.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { digestEntryDefinition } from "../adapters/digest/registration.js"
import { effectDspEntryDefinition } from "../adapters/effect-dsp/registration.js"
import { effectMathEntryDefinition } from "../adapters/effect-math/registration.js"
import { effectSearchEntryDefinition } from "../adapters/effect-search/registration.js"
import { effectTextEntryDefinition } from "../adapters/effect-text/registration.js"
import { sealEntryDefinition } from "../adapters/seal/registration.js"
import { signEntryDefinition } from "../adapters/sign/registration.js"
import { workflowEntryDefinition } from "../adapters/workflow/registration.js"

const definitionsById = {
  "effect-text": effectTextEntryDefinition,
  "effect-search": effectSearchEntryDefinition,
  "effect-math": effectMathEntryDefinition,
  digest: digestEntryDefinition,
  sign: signEntryDefinition,
  seal: sealEntryDefinition,
  "effect-dsp": effectDspEntryDefinition,
  workflow: workflowEntryDefinition
}

type Definition = (typeof definitionsById)[RunnableEntryId]

const definitionForId = (id: RunnableEntryId): Definition => definitionsById[id]

const definitions: ReadonlyArray<Definition> = Arr.map(runnableEntryIds, definitionForId)

const [firstDefinition, ...restDefinitions] = definitions

export const EntryWorkflowLive = Option.match(Option.fromNullable(firstDefinition), {
  onNone: () => Layer.empty,
  onSome: (definition) =>
    Arr.reduce(
      restDefinitions,
      definition.workflowLive,
      (layer, nextDefinition) => Layer.merge(layer, nextDefinition.workflowLive)
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
