import { Effect, Option, Schema } from "effect"

import type { DemoError } from "../../../contracts/demo-error.js"
import type { EntryDraft } from "../../../contracts/entry/registry.js"
import { EntryRunRequest as EntryRunRequestSchema } from "../../../contracts/entry/registry.js"
import type { Metadata } from "../../../contracts/envelope.js"
import type { ProgramPreview } from "../../../contracts/presentation/program-preview.js"
import type { RunData } from "../../../contracts/study/run.js"
import type { RunRegistry } from "../../atoms/run-registry-context.js"
import { EntryClient } from "../../services/EntryClient.js"
import type { LocalProjectionScript } from "../../state/run/local.js"
import type { ProjectionDriverDescriptor } from "./projection-driver.js"

export type SurfaceRuntimeServices = EntryClient

export type SurfaceRunResult = {
  readonly data: RunData
  readonly meta: Metadata
}

export type SurfaceRuntimeSnapshot = {
  readonly draft: EntryDraft | null
  readonly localProjectionScript: LocalProjectionScript | null
}

export type SurfaceTransport = "fetch" | "sse"

export type SurfaceRuntime = {
  readonly transport: SurfaceTransport
  readonly projectionDriver: Option.Option<ProjectionDriverDescriptor>
  readonly preload: Option.Option<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>
  readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
  readonly runWithMeta: Option.Option<
    (
      snapshot: SurfaceRuntimeSnapshot,
      runToken: string
    ) => Effect.Effect<SurfaceRunResult, DemoError, SurfaceRuntimeServices>
  >
  readonly streamUrl: Option.Option<(snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string>
}

export const makeFetchSurfaceRuntime = ({
  preload = Option.none<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>(),
  runWithMeta = Option.none<
    (
      snapshot: SurfaceRuntimeSnapshot,
      runToken: string
    ) => Effect.Effect<SurfaceRunResult, DemoError, SurfaceRuntimeServices>
  >(),
  snapshot = () => ({ draft: null, localProjectionScript: null })
}: {
  readonly preload?: Option.Option<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>
  readonly runWithMeta?: Option.Option<
    (
      snapshot: SurfaceRuntimeSnapshot,
      runToken: string
    ) => Effect.Effect<SurfaceRunResult, DemoError, SurfaceRuntimeServices>
  >
  readonly snapshot?: (registry: RunRegistry) => SurfaceRuntimeSnapshot
} = {}): SurfaceRuntime => ({
  transport: "fetch",
  projectionDriver: Option.none(),
  preload,
  snapshot,
  runWithMeta,
  streamUrl: Option.none()
})

export const fetchSurfaceRuntime: SurfaceRuntime = makeFetchSurfaceRuntime()

export const makeEntryFetchSurfaceRuntime = ({
  entryId,
  preload = true,
  snapshot
}: {
  readonly entryId: EntryDraft["entryId"]
  readonly preload?: boolean
  readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
}): SurfaceRuntime =>
  makeFetchSurfaceRuntime({
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
          Schema.decodeUnknownSync(EntryRunRequestSchema)({
            runToken,
            draft: runtimeSnapshot.draft
          })
        )
      })
    ),
    snapshot
  })

export const makeStreamingSurfaceRuntime = ({
  preload = Option.none<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>(),
  projectionDriver,
  snapshot,
  streamUrl
}: {
  readonly preload?: Option.Option<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>
  readonly projectionDriver: ProjectionDriverDescriptor
  readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
  readonly streamUrl: (snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string
}): SurfaceRuntime => ({
  transport: "sse",
  projectionDriver: Option.some(projectionDriver),
  preload,
  snapshot,
  runWithMeta: Option.none(),
  streamUrl: Option.some(streamUrl)
})

export const makeServerOnlyStreamingSurfaceRuntime = ({
  preload = Option.none<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>(),
  snapshot,
  streamUrl
}: {
  readonly preload?: Option.Option<Effect.Effect<ProgramPreview, DemoError, SurfaceRuntimeServices>>
  readonly snapshot: (registry: RunRegistry) => SurfaceRuntimeSnapshot
  readonly streamUrl: (snapshot: SurfaceRuntimeSnapshot, runToken: string | null) => string
}): SurfaceRuntime => ({
  transport: "sse",
  projectionDriver: Option.none(),
  preload,
  snapshot,
  runWithMeta: Option.none(),
  streamUrl: Option.some(streamUrl)
})
