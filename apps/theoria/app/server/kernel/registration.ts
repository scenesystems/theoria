import type { FileSystem, Path } from "@effect/platform"
import type { Scope } from "effect"
import { Effect, type Stream } from "effect"

import type { DemoCapability } from "../../contracts/capability/availability.js"
import type { CardReleaseState } from "../../contracts/entry/descriptor.js"
import type { AuthorityId, RunnableEntryId } from "../../contracts/entry/id.js"
import type { StreamManifest } from "../../contracts/evidence/manifest.js"
import type { ProgramPreview } from "../../contracts/presentation/program-preview.js"
import type { RunData } from "../../contracts/study/run.js"

import type { DspProviderRuntime } from "../capability/effect-dsp.js"
import type { workflowEntryWorkflowRegistration } from "../study/workflow/comparison/workflow.js"
import type { Lane } from "./kinds/policy.js"
import type { StreamElement } from "./kinds/stream-element.js"
import type { DemoStreamPlan } from "./kinds/stream-plan.js"
import { makeDemoRunWorkflowRegistration } from "./workflow.js"

export type ProgramSourceEnv = FileSystem.FileSystem | Path.Path
export type EntryRunEnv = DspProviderRuntime | ProgramSourceEnv

type RunnableEntryMetadata<Entry extends RunnableEntryId = RunnableEntryId> = {
  readonly entryId: Entry
  readonly title: string
  readonly packageName: string
  readonly useCase: string
  readonly summary: string
  readonly runLabel: string
  readonly path: string
  readonly releaseState: CardReleaseState
  readonly primaryAuthorityId: AuthorityId
}

export type EntryStreamPlanFactory =
  | ((
    manifest: StreamManifest | null
  ) => Effect.Effect<DemoStreamPlan<EntryRunEnv, unknown>, unknown, EntryRunEnv | Scope.Scope>)
  | null

export type EntryWorkflowRegistration = typeof workflowEntryWorkflowRegistration

type EntryRegistrationOptions<Entry extends RunnableEntryId> = {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly capability?: Effect.Effect<DemoCapability, never, DspProviderRuntime> | null
  readonly descriptor: RunnableEntryMetadata<Entry>
  readonly execute: Effect.Effect<RunData, unknown, EntryRunEnv>
  readonly lane: Lane
  readonly preloadProgram: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
  readonly streamElements?: (manifest: StreamManifest | null) => Stream.Stream<StreamElement, unknown, never> | null
  readonly streamPlan: EntryStreamPlanFactory
  readonly workflowRegistration?: EntryWorkflowRegistration
}

export const makeEntryRegistration = <Entry extends RunnableEntryId>(options: EntryRegistrationOptions<Entry>) =>
  options

const previewCardForDescriptor = (descriptor: RunnableEntryMetadata): ProgramPreview["card"] => ({
  id: descriptor.entryId,
  title: descriptor.title,
  packageName: descriptor.packageName,
  useCase: descriptor.useCase,
  summary: descriptor.summary,
  runLabel: descriptor.runLabel,
  deepDivePath: descriptor.path
})

const preloadFromRegistration = ({
  descriptor,
  preloadProgram
}: {
  readonly descriptor: RunnableEntryMetadata
  readonly preloadProgram: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
}): Effect.Effect<ProgramPreview, unknown, ProgramSourceEnv> =>
  preloadProgram.pipe(
    Effect.map((program) => ({
      id: descriptor.entryId,
      card: previewCardForDescriptor(descriptor),
      summary: descriptor.summary,
      program
    }))
  )

const enabledCapability = (id: RunnableEntryId): DemoCapability => ({
  id,
  enabled: true
})

export const materializeEntryDefinition = <Entry extends RunnableEntryId>(
  registration: EntryRegistrationOptions<Entry>
) => {
  const workflowRegistration = registration.workflowRegistration ?? makeDemoRunWorkflowRegistration({
    acceptsManifest: registration.acceptsManifest,
    execute: registration.execute,
    id: registration.descriptor.entryId,
    lane: registration.lane,
    streamPlan: registration.streamPlan
  })

  return {
    id: registration.descriptor.entryId,
    descriptor: registration.descriptor,
    card: previewCardForDescriptor(registration.descriptor),
    authorityId: registration.descriptor.primaryAuthorityId,
    capability: registration.capability ?? Effect.succeed(enabledCapability(registration.descriptor.entryId)),
    lane: registration.lane,
    execute: registration.execute,
    preload: preloadFromRegistration(registration),
    acceptsManifest: registration.acceptsManifest,
    streamPlan: registration.streamPlan,
    streamElements: registration.streamElements ?? (() => null),
    workflow: workflowRegistration.workflow,
    workflowLive: workflowRegistration.workflowLive
  }
}
