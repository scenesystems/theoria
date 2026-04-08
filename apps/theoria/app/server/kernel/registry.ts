import { Effect, Layer } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import type { DemoCapability } from "../../contracts/capability/availability.js"
import { type EntryId, isRunnableEntryId, type RunnableEntryId, runnableEntryIds } from "../../contracts/entry/id.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import { digestEntryRegistration } from "../adapters/digest/registration.js"
import { effectDspEntryRegistration } from "../adapters/effect-dsp/registration.js"
import { effectMathEntryRegistration } from "../adapters/effect-math/registration.js"
import { effectSearchEntryRegistration } from "../adapters/effect-search/registration.js"
import { effectTextEntryRegistration } from "../adapters/effect-text/registration.js"
import { sealEntryRegistration } from "../adapters/seal/registration.js"
import { signEntryRegistration } from "../adapters/sign/registration.js"
import type { DspProviderRuntime } from "../capability/effect-dsp.js"
import { workflowEntryRegistration } from "../study/workflow/comparison/registration.js"
import { materializeEntryDefinition } from "./registration.js"

const pendingCapability = (id: EntryId): DemoCapability => ({
  id,
  enabled: false,
  reason: "Runtime registration has not shipped for this entry yet."
})

const definitionsById = {
  "effect-text": materializeEntryDefinition(effectTextEntryRegistration),
  "effect-search": materializeEntryDefinition(effectSearchEntryRegistration),
  "effect-math": materializeEntryDefinition(effectMathEntryRegistration),
  digest: materializeEntryDefinition(digestEntryRegistration),
  sign: materializeEntryDefinition(signEntryRegistration),
  seal: materializeEntryDefinition(sealEntryRegistration),
  "effect-dsp": materializeEntryDefinition(effectDspEntryRegistration),
  workflow: materializeEntryDefinition(workflowEntryRegistration)
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

export const capabilityForId = (id: EntryId): Effect.Effect<DemoCapability, never, DspProviderRuntime> =>
  Option.match(lookup(id), {
    onNone: () => Effect.succeed(pendingCapability(id)),
    onSome: (definition) => definition.capability
  })
