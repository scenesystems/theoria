import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"

import {
  projectionDriverFor,
  resetProjectionDriverState,
  setProjectionPlayback
} from "../../runtime/kernel/surface-runtime.js"
import { dispatchRunMessage, resetSurfaceEvidenceStore } from "../surface/internal.js"

import {
  dispatchCurrentTimeRunMessage,
  interruptRunAuthority,
  syncCurrentProjectionFrameToControls
} from "./execution-support.js"
import { activeRunFor, pauseActiveRun, resumeActiveRun } from "./lifecycle.js"

export const pauseRun = (
  id: EntryId,
  ctx: AtomType.FnContext
): Effect.Effect<void, never, never> =>
  pauseActiveRun(ctx.registry, id).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (active) =>
          syncCurrentProjectionFrameToControls(ctx.registry, id).pipe(
            Effect.zipRight(setProjectionPlayback(projectionDriverFor(id), ctx.registry, false)),
            Effect.zipRight(
              dispatchCurrentTimeRunMessage(ctx.registry, id, (requestedAtMs) => ({
                _tag: "RunPaused",
                sequence: active.sequence,
                requestedAtMs
              }))
            )
          )
      })
    )
  )

export const resumeRun = (
  id: EntryId,
  ctx: AtomType.FnContext
): Effect.Effect<void, never, never> =>
  resumeActiveRun(ctx.registry, id).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (active) =>
          setProjectionPlayback(projectionDriverFor(id), ctx.registry, true).pipe(
            Effect.zipRight(
              dispatchCurrentTimeRunMessage(ctx.registry, id, (requestedAtMs) => ({
                _tag: "RunResumed",
                sequence: active.sequence,
                requestedAtMs
              }))
            )
          )
      })
    )
  )

export const stopRun = (
  id: EntryId,
  ctx: AtomType.FnContext
): Effect.Effect<void, never, never> =>
  Option.match(activeRunFor(ctx.registry, id), {
    onNone: () => Effect.void,
    onSome: (active) =>
      Effect.gen(function*() {
        yield* dispatchCurrentTimeRunMessage(ctx.registry, id, (requestedAtMs) => ({
          _tag: "RunStopping",
          sequence: active.sequence,
          requestedAtMs
        }))
        yield* interruptRunAuthority({ id, registry: ctx.registry })
        yield* dispatchCurrentTimeRunMessage(ctx.registry, id, (stoppedAtMs) => ({
          _tag: "RunStopped",
          sequence: active.sequence,
          stoppedAtMs
        }))
      })
  })

export const resetRun = (
  id: EntryId,
  ctx: AtomType.FnContext
): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const projectionDriver = projectionDriverFor(id)

    yield* interruptRunAuthority({ id, registry: ctx.registry })
    yield* resetProjectionDriverState(projectionDriver, ctx.registry)
    yield* setProjectionPlayback(projectionDriver, ctx.registry, false)
    resetSurfaceEvidenceStore(ctx.registry, id)

    dispatchRunMessage(ctx.registry, id, { _tag: "RunReset" })
  })
