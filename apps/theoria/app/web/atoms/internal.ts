import { Effect, Either, Option } from "effect"

import type { SurfaceId } from "../../contracts/id.js"
import { surfaceRuntimeFor, type SurfaceRuntimeServices } from "../runtime/surface-runtime.js"
import { emptyEvidenceStoreState, reduceRunState, type RunMessage, type SurfaceState } from "../state/types.js"

import type { RunRegistry } from "./run-registry-context.js"
import { surfaceAtom, surfaceEvidenceStoreAtom } from "./surface.js"

export const modifySurface = (registry: RunRegistry, id: SurfaceId, f: (s: SurfaceState) => SurfaceState): void => {
  registry.update(surfaceAtom(id), f)
}

export const dispatchRunMessage = (registry: RunRegistry, id: SurfaceId, message: RunMessage): void => {
  modifySurface(registry, id, (surface) => ({
    ...surface,
    run: reduceRunState(surface.run, message)
  }))
}

export const resetSurfaceEvidenceStore = (registry: RunRegistry, id: SurfaceId): void => {
  registry.set(surfaceEvidenceStoreAtom(id), emptyEvidenceStoreState)
}

const shouldFetchPreload = (registry: RunRegistry, id: SurfaceId): boolean => {
  const state = registry.get(surfaceAtom(id))

  return state.preload._tag === "PreloadIdle" || state.preload._tag === "PreloadFailed"
}

export const preloadSurface = (
  id: SurfaceId,
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
