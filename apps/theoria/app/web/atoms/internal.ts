import { Effect, Either } from "effect"

import type { Id } from "../../contracts/id.js"
import { DemoClient } from "../services/DemoClient.js"
import { emptyEvidenceStoreState, reduceRunState, type RunMessage, type SurfaceState } from "../state/types.js"

import type { RunRegistry } from "./run-registry-context.js"
import { surfaceAtom, surfaceEvidenceStoreAtom } from "./surface.js"

export const modifySurface = (registry: RunRegistry, id: Id, f: (s: SurfaceState) => SurfaceState): void => {
  registry.update(surfaceAtom(id), f)
}

export const dispatchRunMessage = (registry: RunRegistry, id: Id, message: RunMessage): void => {
  modifySurface(registry, id, (surface) => ({
    ...surface,
    run: reduceRunState(surface.run, message)
  }))
}

export const resetSurfaceEvidenceStore = (registry: RunRegistry, id: Id): void => {
  registry.set(surfaceEvidenceStoreAtom(id), emptyEvidenceStoreState)
}

const shouldFetchPreload = (registry: RunRegistry, id: Id): boolean => {
  const state = registry.get(surfaceAtom(id))

  return state.preload._tag === "PreloadIdle" || state.preload._tag === "PreloadFailed"
}

export const preloadSurface = (id: Id, registry: RunRegistry) =>
  Effect.gen(function*() {
    if (!shouldFetchPreload(registry, id)) {
      return
    }

    modifySurface(registry, id, (s) => ({ ...s, preload: { _tag: "PreloadLoading" } }))

    const client = yield* DemoClient
    const result = yield* client.preload(id).pipe(Effect.either)

    Either.match(result, {
      onLeft: (error) => {
        modifySurface(registry, id, (s) => ({ ...s, preload: { _tag: "PreloadFailed", error } }))
      },
      onRight: (preview) => {
        modifySurface(registry, id, (s) => ({ ...s, preload: { _tag: "PreloadReady", data: preview } }))
      }
    })
  })
