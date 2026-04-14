import { Effect, Option, Schema } from "effect"

import type { EntryError } from "../../../contracts/entry-error.js"
import { EntryStreamRoute } from "../../../contracts/entry/api-route.js"
import { type EntryId } from "../../../contracts/entry/id.js"
import type { ProgramPreview } from "../../../contracts/presentation/program-preview.js"
import { StudyRegistry, StudyRunRequest } from "../../../contracts/study/registry.js"
import type { RunRegistry } from "../../atoms/run-registry-context.js"
import { surfaceDraftAtom, surfaceRunStateAtom } from "../../atoms/surface/state.js"
import { EntryClient } from "../../services/EntryClient.js"
import type { SurfaceRuntime } from "./kind.js"
import { SurfaceRuntime as Runtime } from "./kind.js"

const studyRegistry = StudyRegistry.current()
const StudyRunRequestJson = Schema.parseJson(StudyRunRequest)
const encodeStudyRunRequestJson = Schema.encodeUnknownSync(StudyRunRequestJson)

const preloadDisabledEntryIds: ReadonlyArray<EntryId> = []

const preloadFor = (entryId: EntryId) =>
  preloadDisabledEntryIds.includes(entryId)
    ? Option.none<Effect.Effect<ProgramPreview, EntryError, EntryClient>>()
    : Option.some(
      Effect.gen(function*() {
        const client = yield* EntryClient
        return yield* client.preload(entryId)
      })
    )

const draftForRuntime = (entryId: EntryId, registry: RunRegistry) => {
  const frozenDraft = registry.get(surfaceRunStateAtom(entryId)).session.draft

  return frozenDraft !== null && frozenDraft.entryId === entryId
    ? frozenDraft
    : registry.get(surfaceDraftAtom(entryId))
}

const streamingRuntimeFor = (entryId: EntryId): SurfaceRuntime =>
  Runtime.serverOnlyStreaming({
    preload: preloadFor(entryId),
    snapshot: (registry) => ({
      draft: draftForRuntime(entryId, registry),
      localProjectionScript: null
    }),
    streamUrl: (snapshot, runToken) => {
      const draft = snapshot.draft ?? studyRegistry.defaultDraftForEntryId(entryId)

      return EntryStreamRoute.fromEntryId(entryId).url(
        encodeStudyRunRequestJson({
          runToken: runToken ?? `${entryId}:stream`,
          draft
        })
      )
    }
  })

const surfaceRuntimeById: Readonly<Record<EntryId, SurfaceRuntime>> = {
  workflow: streamingRuntimeFor("workflow")
}

export const surfaceRuntimeForEntry = (id: EntryId): SurfaceRuntime => surfaceRuntimeById[id]
