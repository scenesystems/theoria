import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Either } from "effect"

import type { Id } from "../../contracts/id.js"
import { DemoClient } from "../services/DemoClient.js"
import { emptyEvidenceStoreState, reduceRunState, type RunMessage, type SurfaceState } from "../state/types.js"

import { surfaceAtom, surfaceEvidenceStoreAtom } from "./surface.js"

export const modifySurface = (ctx: AtomType.FnContext, id: Id, f: (s: SurfaceState) => SurfaceState): void => {
  const current = ctx(surfaceAtom(id))
  ctx.set(surfaceAtom(id), f(current))
}

export const dispatchRunMessage = (ctx: AtomType.FnContext, id: Id, message: RunMessage): void => {
  modifySurface(ctx, id, (surface) => ({
    ...surface,
    run: reduceRunState(surface.run, message)
  }))
}

export const resetSurfaceEvidenceStore = (ctx: AtomType.FnContext, id: Id): void => {
  ctx.set(surfaceEvidenceStoreAtom(id), emptyEvidenceStoreState)
}

const shouldFetchPreload = (ctx: AtomType.FnContext, id: Id): boolean => {
  const state = ctx(surfaceAtom(id))

  return state.preload._tag === "PreloadIdle" || state.preload._tag === "PreloadFailed"
}

export const preloadSurface = (id: Id, ctx: AtomType.FnContext) =>
  Effect.gen(function*() {
    if (!shouldFetchPreload(ctx, id)) {
      return
    }

    modifySurface(ctx, id, (s) => ({ ...s, preload: { _tag: "PreloadLoading" } }))

    const client = yield* DemoClient
    const result = yield* client.preload(id).pipe(Effect.either)

    Either.match(result, {
      onLeft: (error) => {
        modifySurface(ctx, id, (s) => ({ ...s, preload: { _tag: "PreloadFailed", error } }))
      },
      onRight: (preview) => {
        modifySurface(ctx, id, (s) => ({ ...s, preload: { _tag: "PreloadReady", data: preview } }))
      }
    })
  })
