import type { FileSystem, Path } from "@effect/platform"
import { Workflow } from "@effect/workflow"
import type { PackageName } from "@theoria/source-proof/contracts"
import type { Scope } from "effect"
import { Effect, type Stream } from "effect"

import type { EntryCapabilityAvailability } from "../../contracts/capability/availability.js"
import { EntryExecutionError } from "../../contracts/entry-error.js"
import type { CardReleaseState } from "../../contracts/entry/descriptor.js"
import type { AuthorityId, RunnableEntryId } from "../../contracts/entry/id.js"
import type { StreamManifest } from "../../contracts/evidence/manifest.js"
import type { ProgramPreview } from "../../contracts/presentation/program-preview.js"
import { RunData } from "../../contracts/study/run.js"

import type { DspProviderRuntime } from "../capability/effect-dsp.js"
import type { Lane } from "./kinds/policy.js"
import type { StreamElement } from "./kinds/stream-element.js"
import type { DemoStreamPlan } from "./kinds/stream-plan.js"
import { encodeEntryStreamRequestJson, EntryStreamRequest } from "./stream-request.js"
import { runEntryWorkflowExecution } from "./workflow-execution.js"

export type ProgramSourceEnv = FileSystem.FileSystem | Path.Path
export type EntryRunEnv = DspProviderRuntime | ProgramSourceEnv

type RunnableEntryMetadata<Entry extends RunnableEntryId = RunnableEntryId> = {
  readonly entryId: Entry
  readonly title: string
  readonly packageName: PackageName
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

type EntryWorkflowRegistrationOptions = {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly execute: Effect.Effect<RunData, unknown, EntryRunEnv> | null
  readonly id: RunnableEntryId
  readonly lane: Lane
  readonly streamPlan: EntryStreamPlanFactory
}

const defineEntryWorkflowRegistration = ({
  acceptsManifest,
  execute,
  id,
  lane,
  streamPlan
}: EntryWorkflowRegistrationOptions) => {
  const workflow = Workflow.make({
    name: `theoria-entry-${id}-run`,
    payload: EntryStreamRequest,
    success: RunData,
    error: EntryExecutionError,
    idempotencyKey: encodeEntryStreamRequestJson
  })

  return {
    workflow,
    workflowLive: workflow.toLayer(
      Effect.fnUntraced(function*(request, executionId) {
        return yield* runEntryWorkflowExecution({
          acceptsManifest,
          execute,
          executionId,
          id,
          lane,
          request,
          streamPlan
        })
      })
    )
  }
}

type InferReturn<T> = T extends (...args: infer _Args) => infer Returned ? Returned : never

export type EntryWorkflowRegistration = InferReturn<typeof defineEntryWorkflowRegistration>

export const EntryWorkflowRegistration = {
  define: defineEntryWorkflowRegistration
}

export type EntryRegistrationOptions<Entry extends RunnableEntryId = RunnableEntryId> = {
  readonly acceptsManifest: (manifest: StreamManifest | null) => boolean
  readonly capability?: Effect.Effect<EntryCapabilityAvailability, never, DspProviderRuntime> | null
  readonly descriptor: RunnableEntryMetadata<Entry>
  readonly execute?: Effect.Effect<RunData, unknown, EntryRunEnv> | null
  readonly lane: Lane
  readonly preloadProgram: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
  readonly streamElements?: (manifest: StreamManifest | null) => Stream.Stream<StreamElement, unknown, never> | null
  readonly streamPlan: EntryStreamPlanFactory
  readonly workflowRegistration?: EntryWorkflowRegistration
}

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

const enabledCapability = (id: RunnableEntryId): EntryCapabilityAvailability => ({
  id,
  enabled: true
})

export const materializeEntryDefinition = <Entry extends RunnableEntryId>(
  registration: EntryRegistrationOptions<Entry>
) => {
  const workflowRegistration = registration.workflowRegistration ?? EntryWorkflowRegistration.define({
    acceptsManifest: registration.acceptsManifest,
    execute: registration.execute ?? null,
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
    execute: registration.execute ?? null,
    preload: preloadFromRegistration(registration),
    acceptsManifest: registration.acceptsManifest,
    streamPlan: registration.streamPlan,
    streamElements: registration.streamElements ?? (() => null),
    workflow: workflowRegistration.workflow,
    workflowLive: workflowRegistration.workflowLive
  }
}
