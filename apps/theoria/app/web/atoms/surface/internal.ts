import { Effect, Either, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import { emptyEvidenceStoreState } from "../../../contracts/evidence/store.js"
import { surfaceRuntimeFor, type SurfaceRuntimeServices } from "../../runtime/kernel/surface-runtime.js"
import type { RunMessage } from "../../state/run/messages.js"
import { reduceRunState } from "../../state/run/reducer.js"
import type { SurfaceState } from "../../state/surface/state.js"

import type { RunRegistry } from "../run-registry-context.js"
import { surfaceAtom, surfaceEvidenceStoreAtom } from "./state.js"

export const modifySurface = (registry: RunRegistry, id: EntryId, f: (s: SurfaceState) => SurfaceState): void => {
  registry.update(surfaceAtom(id), f)
}

export const dispatchRunMessage = (registry: RunRegistry, id: EntryId, message: RunMessage): void => {
  modifySurface(registry, id, (surface) => ({
    ...surface,
    run: reduceRunState(surface.run, message)
  }))
}

export const resetSurfaceEvidenceStore = (registry: RunRegistry, id: EntryId): void => {
  registry.set(surfaceEvidenceStoreAtom(id), emptyEvidenceStoreState)
}

const shouldFetchPreload = (registry: RunRegistry, id: EntryId): boolean => {
  const state = registry.get(surfaceAtom(id))

  return state.preload._tag === "PreloadIdle" || state.preload._tag === "PreloadFailed"
}

export const preloadSurface = (
  id: EntryId,
  registry: RunRegistry
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.gen(function*() {
    if (!shouldFetchPreload(registry, id)) {
      return
    }

    const preloadEffect = surfaceRuntimeFor(id).preload

    if (Option.isNone(preloadEffect)) {
      return
    }

    modifySurface(registry, id, (s) => ({ ...s, preload: { _tag: "PreloadLoading" } }))

    const result = yield* preloadEffect.value.pipe(Effect.either)

    Either.match(result, {
      onLeft: (error) => {
        modifySurface(registry, id, (s) => ({ ...s, preload: { _tag: "PreloadFailed", error } }))
      },
      onRight: (preview) => {
        modifySurface(registry, id, (s) => ({ ...s, preload: { _tag: "PreloadReady", data: preview } }))
      }
    })
  })
