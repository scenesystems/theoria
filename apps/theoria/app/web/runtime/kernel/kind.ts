import { Data, Effect, Option, Schema } from "effect"

import type { EntryError } from "../../../contracts/entry-error.js"
import type { Metadata } from "../../../contracts/envelope.js"
import type { ProgramPreview } from "../../../contracts/presentation/program-preview.js"
import { type StudyDraft, StudyRunRequest as StudyRunRequestSchema } from "../../../contracts/study/registry.js"
import type { RunData } from "../../../contracts/study/run.js"
import type { RunRegistry } from "../../atoms/run-registry-context.js"
import { EntryClient } from "../../services/EntryClient.js"
import type { LocalProjectionScript } from "../../state/run/local.js"
import type { ProjectionDriverDescriptor } from "./projection-driver.js"

export type SurfaceRuntimeServices = EntryClient

export interface SurfaceRunResult {
  readonly data: RunData
  readonly meta: Metadata
}

export interface SurfaceRuntimeSnapshot {
  readonly draft: StudyDraft | null
  readonly localProjectionScript: LocalProjectionScript | null
}

export type SurfaceTransport = "fetch" | "sse"

export class SurfaceRuntime extends Data.Class<SurfaceRuntime.Shape> {
  static fetch({
    preload = Option.none<Effect.Effect<ProgramPreview, EntryError, SurfaceRuntimeServices>>(),
    runWithMeta = Option.none<
      (
        snapshot: SurfaceRuntimeSnapshot,
        runToken: string
      ) => Effect.Effect<SurfaceRunResult, EntryError, SurfaceRuntimeServices>
    >(),
    snapshot = () => ({ draft: null, localProjectionScript: null })
  }: {
    readonly preload?: Option.Option<Effect.Effect<ProgramPreview, EntryError, SurfaceRuntimeServices>>
    readonly runWithMeta?: Option.Option<
      (
        snapshot: SurfaceRuntimeSnapshot,
        runToken: string
      ) => Effect.Effect<SurfaceRunResult, EntryError, SurfaceRuntimeServices>
    >
    readonly snapshot?: (registry: RunRegistry) => SurfaceRuntimeSnapshot
  } = {}): SurfaceRuntime {
    return new SurfaceRuntime({
      transport: "fetch",
      projectionDriver: Option.none(),
      preload,
      snapshot,
      runWithMeta,
      streamUrl: Option.none()
    })
  }

  static entryFetch({
    entryId,
    preload = true,
    snapshot
  }: {
    readonly entryId: StudyDraft["entryId"]
    readonly preload?: boolean
    readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
  }): SurfaceRuntime {
    return SurfaceRuntime.fetch({
      preload: preload
        ? Option.some(
          Effect.gen(function*() {
            const client = yield* EntryClient
            return yield* client.preload(entryId)
          })
        )
        : Option.none(),
      runWithMeta: Option.some((runtimeSnapshot, runToken) =>
        Effect.gen(function*() {
          if (runtimeSnapshot.draft === null || runtimeSnapshot.draft.entryId !== entryId) {
            return yield* Effect.dieMessage(`Entry runtime for ${entryId} is missing a matching draft.`)
          }

          const client = yield* EntryClient

          return yield* client.runWithMeta(
            Schema.decodeUnknownSync(StudyRunRequestSchema)({
              runToken,
              draft: runtimeSnapshot.draft
            })
          )
        })
      ),
      snapshot
    })
  }

  static streaming({
    preload = Option.none<Effect.Effect<ProgramPreview, EntryError, SurfaceRuntimeServices>>(),
    projectionDriver,
    snapshot,
    streamUrl
  }: {
    readonly preload?: Option.Option<Effect.Effect<ProgramPreview, EntryError, SurfaceRuntimeServices>>
    readonly projectionDriver: ProjectionDriverDescriptor
    readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
    readonly streamUrl: (snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string
  }): SurfaceRuntime {
    return new SurfaceRuntime({
      transport: "sse",
      projectionDriver: Option.some(projectionDriver),
      preload,
      snapshot,
      runWithMeta: Option.none(),
      streamUrl: Option.some(streamUrl)
    })
  }

  static serverOnlyStreaming({
    preload = Option.none<Effect.Effect<ProgramPreview, EntryError, SurfaceRuntimeServices>>(),
    snapshot,
    streamUrl
  }: {
    readonly preload?: Option.Option<Effect.Effect<ProgramPreview, EntryError, SurfaceRuntimeServices>>
    readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
    readonly streamUrl: (snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string
  }): SurfaceRuntime {
    return new SurfaceRuntime({
      transport: "sse",
      projectionDriver: Option.none(),
      preload,
      snapshot,
      runWithMeta: Option.none(),
      streamUrl: Option.some(streamUrl)
    })
  }
}

export namespace SurfaceRuntime {
  export interface Shape {
    readonly transport: SurfaceTransport
    readonly projectionDriver: Option.Option<ProjectionDriverDescriptor>
    readonly preload: Option.Option<Effect.Effect<ProgramPreview, EntryError, SurfaceRuntimeServices>>
    readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
    readonly runWithMeta: Option.Option<
      (
        snapshot: SurfaceRuntimeSnapshot,
        runToken: string
      ) => Effect.Effect<SurfaceRunResult, EntryError, SurfaceRuntimeServices>
    >
    readonly streamUrl: Option.Option<(snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string>
  }
}

export const fetchSurfaceRuntime: SurfaceRuntime = SurfaceRuntime.fetch()
