import type { FileSystem, Path } from "@effect/platform"
import type { Scope } from "effect"
import { Effect, Layer, Schema, type Stream } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import type { DemoCapability } from "../../contracts/capabilities.js"
import { cardForId, cardVisibleInReleaseStage } from "../../contracts/card.js"
import { type Id, isRunnableDemoId, type RunnableDemoId, runnableDemoIds } from "../../contracts/id.js"
import type { ProgramPreview } from "../../contracts/program-preview.js"
import type { ReleaseStage } from "../../contracts/release-stage.js"
import type { RunData } from "../../contracts/run.js"
import {
  EffectDspManifest,
  EffectMathManifest,
  EffectSearchManifest,
  EffectTextManifest,
  type StreamManifest
} from "../../contracts/stream-manifest.js"

import { preloadProgram as preloadDigestProgram, run as runDigest } from "./digest/run.js"
import { DspProviderRuntime } from "./effect-dsp/provider.js"
import {
  preloadProgram as preloadEffectDspProgram,
  run as runEffectDsp,
  streamElements as streamEffectDspElements,
  streamPlan as streamEffectDspPlan
} from "./effect-dsp/run.js"
import {
  preloadProgram as preloadEffectMathProgram,
  run as runEffectMath,
  streamElements as streamEffectMathElements,
  streamPlan as streamEffectMathPlan
} from "./effect-math/run.js"
import {
  preloadProgram as preloadEffectSearchProgram,
  run as runEffectSearch,
  streamElements as streamEffectSearchElements,
  streamPlan as streamEffectSearchPlan
} from "./effect-search/run.js"
import {
  preloadProgram as preloadEffectTextProgram,
  run as runEffectText,
  streamElements as streamEffectTextElements,
  streamPlan as streamEffectTextPlan
} from "./effect-text/run.js"
import type { Lane } from "./policy.js"
import { preloadProgram as preloadSealProgram, run as runSeal } from "./seal/run.js"
import { preloadProgram as preloadSignProgram, run as runSign } from "./sign/run.js"
import type { StreamElement } from "./stream-element.js"
import type { DemoStreamPlan } from "./stream-plan.js"
import { makeDemoRunWorkflowRegistration } from "./workflow.js"

type ProgramSourceEnv = FileSystem.FileSystem | Path.Path

type StreamPlanFactory =
  | ((
    manifest: StreamManifest | null
  ) => Effect.Effect<
    DemoStreamPlan<DspProviderRuntime | ProgramSourceEnv, unknown>,
    unknown,
    DspProviderRuntime | ProgramSourceEnv | Scope.Scope
  >)
  | null

type DefinitionRegistration = {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly capability?: Effect.Effect<DemoCapability, never, DspProviderRuntime> | null
  readonly execute: Effect.Effect<RunData, unknown, DspProviderRuntime | ProgramSourceEnv>
  readonly id: RunnableDemoId
  readonly lane: Lane
  readonly preloadProgram: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
  readonly streamElements?: (manifest: StreamManifest | null) => Stream.Stream<StreamElement, unknown, never> | null
  readonly streamPlan?: StreamPlanFactory
}

const preloadFrom = ({
  id,
  program
}: {
  readonly id: RunnableDemoId
  readonly program: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
}): Effect.Effect<ProgramPreview, unknown, ProgramSourceEnv> =>
  program.pipe(
    Effect.map((loadedProgram) => ({
      id,
      card: cardForId(id),
      summary: cardForId(id).summary,
      program: loadedProgram
    }))
  )

const acceptsNoManifest = (manifest: StreamManifest | null): boolean => manifest === null

const acceptsEffectTextManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectTextManifest)(manifest)

const acceptsEffectSearchManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectSearchManifest)(manifest)

const acceptsEffectMathManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectMathManifest)(manifest)

const acceptsEffectDspManifest = (manifest: StreamManifest | null): boolean =>
  manifest === null || Schema.is(EffectDspManifest)(manifest)

const enabledCapability = (id: RunnableDemoId): DemoCapability => ({
  id,
  enabled: true
})

const pendingCapability = (id: Id): DemoCapability => ({
  id,
  enabled: false,
  reason: "Runtime registration has not shipped for this demo yet."
})

const effectDspCapability = Effect.gen(function*() {
  const runtime = yield* DspProviderRuntime

  const capability: DemoCapability = {
    id: "effect-dsp",
    enabled: runtime.capability.enabled,
    ...Option.match(runtime.capability.reason, {
      onNone: () => ({}),
      onSome: (reason) => ({ reason })
    })
  }

  return capability
})

const makeDefinition = ({
  acceptsManifest,
  capability = null,
  execute,
  id,
  lane,
  preloadProgram,
  streamElements = () => null,
  streamPlan = null
}: {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly capability?: Effect.Effect<DemoCapability, never, DspProviderRuntime> | null
  readonly execute: Effect.Effect<RunData, unknown, DspProviderRuntime | ProgramSourceEnv>
  readonly id: RunnableDemoId
  readonly lane: Lane
  readonly preloadProgram: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
  readonly streamElements?: (manifest: StreamManifest | null) => Stream.Stream<StreamElement, unknown, never> | null
  readonly streamPlan?: StreamPlanFactory
}) => {
  const workflowRegistration = makeDemoRunWorkflowRegistration({
    acceptsManifest,
    execute,
    id,
    lane,
    streamPlan
  })

  return {
    id,
    card: cardForId(id),
    capability: capability ?? Effect.succeed(enabledCapability(id)),
    lane,
    execute,
    preload: preloadFrom({ id, program: preloadProgram }),
    acceptsManifest,
    streamPlan,
    streamElements,
    workflow: workflowRegistration.workflow,
    workflowLive: workflowRegistration.workflowLive
  }
}

const definitionRegistrationsById: Readonly<Record<RunnableDemoId, DefinitionRegistration>> = {
  "effect-text": {
    id: "effect-text",
    lane: "local",
    execute: runEffectText,
    preloadProgram: preloadEffectTextProgram,
    acceptsManifest: acceptsEffectTextManifest,
    streamPlan: streamEffectTextPlan,
    streamElements: streamEffectTextElements
  },
  "effect-search": {
    id: "effect-search",
    lane: "local",
    execute: runEffectSearch,
    preloadProgram: preloadEffectSearchProgram,
    acceptsManifest: acceptsEffectSearchManifest,
    streamPlan: streamEffectSearchPlan,
    streamElements: streamEffectSearchElements
  },
  "effect-math": {
    id: "effect-math",
    lane: "local",
    execute: runEffectMath,
    preloadProgram: preloadEffectMathProgram,
    acceptsManifest: acceptsEffectMathManifest,
    streamPlan: streamEffectMathPlan,
    streamElements: streamEffectMathElements
  },
  digest: {
    id: "digest",
    lane: "local",
    execute: runDigest,
    preloadProgram: preloadDigestProgram,
    acceptsManifest: acceptsNoManifest
  },
  sign: {
    id: "sign",
    lane: "local",
    execute: runSign,
    preloadProgram: preloadSignProgram,
    acceptsManifest: acceptsNoManifest
  },
  seal: {
    id: "seal",
    lane: "local",
    execute: runSeal,
    preloadProgram: preloadSealProgram,
    acceptsManifest: acceptsNoManifest
  },
  "effect-dsp": {
    id: "effect-dsp",
    lane: "provider",
    capability: effectDspCapability,
    execute: runEffectDsp,
    preloadProgram: preloadEffectDspProgram,
    acceptsManifest: acceptsEffectDspManifest,
    streamPlan: streamEffectDspPlan,
    streamElements: streamEffectDspElements
  }
}

const definitionsById = {
  "effect-text": makeDefinition(definitionRegistrationsById["effect-text"]),
  "effect-search": makeDefinition(definitionRegistrationsById["effect-search"]),
  "effect-math": makeDefinition(definitionRegistrationsById["effect-math"]),
  digest: makeDefinition(definitionRegistrationsById.digest),
  sign: makeDefinition(definitionRegistrationsById.sign),
  seal: makeDefinition(definitionRegistrationsById.seal),
  "effect-dsp": makeDefinition(definitionRegistrationsById["effect-dsp"])
}

type Definition = (typeof definitionsById)[RunnableDemoId]

const definitionForId = (id: RunnableDemoId): Definition => definitionsById[id]

const definitions: ReadonlyArray<Definition> = Arr.map(runnableDemoIds, definitionForId)

const [firstDefinition, ...restDefinitions] = definitions

export const DemoWorkflowLive = Option.match(Option.fromNullable(firstDefinition), {
  onNone: () => Layer.empty,
  onSome: (definition) =>
    Arr.reduce(
      restDefinitions,
      definition.workflowLive,
      (layer, nextDefinition) => Layer.merge(layer, nextDefinition.workflowLive)
    )
})

export const lookup = (id: Id): Option.Option<Definition> =>
  isRunnableDemoId(id)
    ? Option.some(definitionForId(id))
    : Option.none()

export const lookupForReleaseStage = (id: Id, stage: ReleaseStage): Option.Option<Definition> =>
  lookup(id).pipe(
    Option.filter((definition) => cardVisibleInReleaseStage(definition.card, stage))
  )

export const capabilityForId = (id: Id): Effect.Effect<DemoCapability, never, DspProviderRuntime> =>
  Option.match(lookup(id), {
    onNone: () => Effect.succeed(pendingCapability(id)),
    onSome: (definition) => definition.capability
  })
