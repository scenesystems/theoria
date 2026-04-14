import type { FileSystem, Path } from "@effect/platform"
import { Workflow } from "@effect/workflow"
import type { PackageName } from "@theoria/source-proof/contracts"
import type { Scope } from "effect"
import { Data, Effect, type Stream } from "effect"

import { EntryCapabilityAvailability } from "../../contracts/capability/availability.js"
import { EntryExecutionError } from "../../contracts/entry-error.js"
import type { CardReleaseState } from "../../contracts/entry/descriptor.js"
import type { AuthorityId, RunnableEntryId } from "../../contracts/entry/id.js"
import { ProgramPreview, programPreviewCard } from "../../contracts/presentation/program-preview.js"
import type { StudyManifest } from "../../contracts/study/manifest.js"
import { RunData } from "../../contracts/study/run.js"

import type { DspProviderRuntime } from "../capability/effect-dsp.js"
import type { Lane } from "./kinds/policy.js"
import type { StreamElement } from "./kinds/stream-element.js"
import type { DemoStreamPlan } from "./kinds/stream-plan.js"
import { encodeEntryStreamRequestJson, EntryStreamRequest } from "./stream-request.js"
import { runStudyExecution } from "./study-execution.js"

export type ProgramSourceEnv = FileSystem.FileSystem | Path.Path
export type StudyRunEnv = DspProviderRuntime | ProgramSourceEnv

type EntryBindingMetadata<Entry extends RunnableEntryId = RunnableEntryId> = {
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

export type StudyStreamPlanFactory =
  | ((
    manifest: StudyManifest | null
  ) => Effect.Effect<DemoStreamPlan<StudyRunEnv, unknown>, unknown, StudyRunEnv | Scope.Scope>)
  | null

type StudyExecutionRegistrationOptions = {
  readonly acceptsManifest: (manifest: StudyManifest | null) => boolean
  readonly execute: Effect.Effect<RunData, unknown, StudyRunEnv> | null
  readonly id: RunnableEntryId
  readonly lane: Lane
  readonly streamPlan: StudyStreamPlanFactory
}
type InferReturn<T> = T extends (...args: infer _Args) => infer Returned ? Returned : never

export class StudyExecutionRegistration extends Data.Class<StudyExecutionRegistration.Shape> {
  static shape({
    acceptsManifest,
    execute,
    id,
    lane,
    streamPlan
  }: StudyExecutionRegistrationOptions) {
    const execution = Workflow.make({
      name: `theoria-entry-${id}-run`,
      payload: EntryStreamRequest,
      success: RunData,
      error: EntryExecutionError,
      idempotencyKey: encodeEntryStreamRequestJson
    })

    return {
      execution,
      executionLive: execution.toLayer(
        Effect.fnUntraced(function*(request, executionId) {
          return yield* runStudyExecution({
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

  static make({
    acceptsManifest,
    execute,
    id,
    lane,
    streamPlan
  }: StudyExecutionRegistrationOptions): StudyExecutionRegistration {
    return new StudyExecutionRegistration(StudyExecutionRegistration.shape({
      acceptsManifest,
      execute,
      id,
      lane,
      streamPlan
    }))
  }
}

export namespace StudyExecutionRegistration {
  export interface Shape extends InferReturn<typeof StudyExecutionRegistration.shape> {}
}

export type StudyDefinitionOptions<Entry extends RunnableEntryId = RunnableEntryId> = {
  readonly acceptsManifest: (manifest: StudyManifest | null) => boolean
  readonly capability?: Effect.Effect<EntryCapabilityAvailability, never, DspProviderRuntime> | null
  readonly descriptor: EntryBindingMetadata<Entry>
  readonly execute?: Effect.Effect<RunData, unknown, StudyRunEnv> | null
  readonly lane: Lane
  readonly preloadProgram: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
  readonly streamElements?: (manifest: StudyManifest | null) => Stream.Stream<StreamElement, unknown, never> | null
  readonly streamPlan: StudyStreamPlanFactory
  readonly executionRegistration?: StudyExecutionRegistration
}

export class StudyDefinition extends Data.Class<StudyDefinition.Shape> {
  private static previewCard(descriptor: EntryBindingMetadata): ProgramPreview["card"] {
    return programPreviewCard({
      deepDivePath: descriptor.path,
      id: descriptor.entryId,
      packageName: descriptor.packageName,
      runLabel: descriptor.runLabel,
      summary: descriptor.summary,
      title: descriptor.title,
      useCase: descriptor.useCase
    })
  }

  private static preload({
    descriptor,
    preloadProgram
  }: {
    readonly descriptor: EntryBindingMetadata
    readonly preloadProgram: Effect.Effect<ProgramPreview["program"], unknown, ProgramSourceEnv>
  }): Effect.Effect<ProgramPreview, unknown, ProgramSourceEnv> {
    return preloadProgram.pipe(
      Effect.map((program) =>
        ProgramPreview.make({
          id: descriptor.entryId,
          card: StudyDefinition.previewCard(descriptor),
          summary: descriptor.summary,
          program
        })
      )
    )
  }

  static make<Entry extends RunnableEntryId>(registration: StudyDefinitionOptions<Entry>): StudyDefinition {
    const executionRegistration = registration.executionRegistration ?? StudyExecutionRegistration.make({
      acceptsManifest: registration.acceptsManifest,
      execute: registration.execute ?? null,
      id: registration.descriptor.entryId,
      lane: registration.lane,
      streamPlan: registration.streamPlan
    })

    return new StudyDefinition({
      id: registration.descriptor.entryId,
      descriptor: registration.descriptor,
      card: StudyDefinition.previewCard(registration.descriptor),
      authorityId: registration.descriptor.primaryAuthorityId,
      capability: registration.capability ??
        Effect.succeed(EntryCapabilityAvailability.enabled(registration.descriptor.entryId)),
      lane: registration.lane,
      execute: registration.execute ?? null,
      preload: StudyDefinition.preload(registration),
      acceptsManifest: registration.acceptsManifest,
      streamPlan: registration.streamPlan,
      streamElements: registration.streamElements ?? (() => null),
      execution: executionRegistration.execution,
      executionLive: executionRegistration.executionLive
    })
  }
}

export namespace StudyDefinition {
  export interface Shape {
    readonly id: RunnableEntryId
    readonly descriptor: EntryBindingMetadata
    readonly card: ProgramPreview["card"]
    readonly authorityId: AuthorityId
    readonly capability: Effect.Effect<EntryCapabilityAvailability, never, DspProviderRuntime>
    readonly lane: Lane
    readonly execute: Effect.Effect<RunData, unknown, StudyRunEnv> | null
    readonly preload: Effect.Effect<ProgramPreview, unknown, ProgramSourceEnv>
    readonly acceptsManifest: (manifest: StudyManifest | null) => boolean
    readonly streamPlan: StudyStreamPlanFactory
    readonly streamElements: (manifest: StudyManifest | null) => Stream.Stream<StreamElement, unknown, never> | null
    readonly execution: StudyExecutionRegistration["execution"]
    readonly executionLive: StudyExecutionRegistration["executionLive"]
  }
}
