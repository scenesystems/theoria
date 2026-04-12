import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Match, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import { EvidenceStore } from "../../../contracts/evidence/store.js"
import { resolveRunRequestIdentityFromDraft } from "../../../contracts/study/run-plan.js"

import type { SurfaceRuntimeServices } from "../../runtime/kernel/kind.js"
import {
  projectionDriverFor,
  resetProjectionDriverState,
  runOwnershipFor,
  setProjectionPlayback,
  snapshotProjectionDriver,
  surfaceRuntimeFor,
  surfaceRuntimeSnapshotFor
} from "../../runtime/kernel/surface-runtime.js"
import { surfaceEvidenceStoreAtom } from "../surface/evidence-store.js"
import { dispatchRunMessage, modifySurface, preloadSurface, resetSurfaceEvidenceStore } from "../surface/internal.js"
import { surfaceAtom } from "../surface/state.js"

import { runEvidencePipeline } from "./evidence-pipeline.js"
import {
  applyEvidenceEventToSurface,
  dispatchCurrentTimeRunMessage,
  interruptRunAuthority,
  pendingProgram,
  runDataFromStore,
  runIsPaused,
  type RunningExecution,
  syncCurrentProjectionFrameToControls
} from "./execution-support.js"
import { allocateRunToken, registerActiveRun, releaseActiveRun, RunSignal } from "./lifecycle.js"

const runSurfaceExecution = (
  id: EntryId,
  active: RunningExecution,
  registry: AtomType.FnContext["registry"]
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.gen(function*() {
    yield* preloadSurface(id, registry)
    const runtime = surfaceRuntimeFor(id)
    const runtimeSnapshot = surfaceRuntimeSnapshotFor(id, registry)

    if (runtimeSnapshot.draft === null) {
      return
    }

    const draft = runtimeSnapshot.draft
    modifySurface(registry, id, (surface) => ({
      ...surface,
      draft
    }))

    const runToken = `${id}:${active.token}`
    const identity = yield* resolveRunRequestIdentityFromDraft({ draft, runToken })

    const projectionDriver = projectionDriverFor(id)
    const projectionDriverSnapshot = snapshotProjectionDriver(projectionDriver, registry)
    const program = Match.value(registry.get(surfaceAtom(id)).preload).pipe(
      Match.tag("PreloadReady", ({ data }) => data.program),
      Match.orElse(() => pendingProgram)
    )

    modifySurface(registry, id, (surface) => ({
      ...surface,
      nextSequence: active.sequence + 1
    }))
    yield* dispatchCurrentTimeRunMessage(registry, id, (startedAtMs) => ({
      _tag: "RunStarted",
      token: active.token,
      sequence: active.sequence,
      ownership: runOwnershipFor(projectionDriver),
      startedAtMs,
      draft,
      identity,
      localProjectionScript: runtimeSnapshot.localProjectionScript,
      program
    }))
    resetSurfaceEvidenceStore(registry, id)

    yield* Match.value(runtime.transport).pipe(
      Match.when("fetch", () =>
        Effect.gen(function*() {
          const runWithMeta = runtime.runWithMeta

          if (Option.isNone(runWithMeta)) {
            return
          }

          const { data, meta } = yield* runWithMeta.value(runtimeSnapshot, runToken)
          const store = EvidenceStore.fromSections({
            sections: data.sections,
            complete: true,
            summary: data.summary,
            meta
          })

          registry.set(surfaceEvidenceStoreAtom(id), store)
          yield* dispatchCurrentTimeRunMessage(registry, id, (observedAtMs) => ({
            _tag: "RunStreamCompleteObserved",
            sequence: active.sequence,
            observedAtMs,
            summary: data.summary,
            meta
          }))
          yield* dispatchCurrentTimeRunMessage(registry, id, (finalizedAtMs) => ({
            _tag: "RunSucceeded",
            sequence: active.sequence,
            finalizedAtMs,
            data,
            meta
          }))
        })),
      Match.orElse(() =>
        runEvidencePipeline({
          registry,
          id,
          runtime,
          runtimeSnapshot,
          projectionDriver,
          projectionDriverSnapshot,
          onCue: (cue, state) =>
            Effect.sync(() => {
              dispatchRunMessage(registry, id, {
                _tag: "RunChoreographyObserved",
                sequence: active.sequence,
                cue,
                state
              })
            }),
          onCanonicalFrameObserved: (frame) =>
            Effect.sync(() => {
              dispatchRunMessage(registry, id, {
                _tag: "RunCanonicalFrameObserved",
                sequence: active.sequence,
                frame
              })
            }),
          onEvent: (event) =>
            Effect.sync(() => {
              applyEvidenceEventToSurface(registry, id, active.sequence, event)
            }),
          onFrame: (frame) =>
            Effect.sync(() => {
              dispatchRunMessage(registry, id, {
                _tag: "RunFrameUpdated",
                sequence: active.sequence,
                frame
              })
            }),
          onStepQueueDrained: () =>
            dispatchCurrentTimeRunMessage(registry, id, (observedAtMs) => ({
              _tag: "RunStepQueueDrained",
              sequence: active.sequence,
              observedAtMs
            })),
          onSuccessGateSatisfied: (store) =>
            Effect.sync(() => {
              registry.set(surfaceEvidenceStoreAtom(id), store)
            }).pipe(
              Effect.zipRight(
                dispatchCurrentTimeRunMessage(registry, id, (finalizedAtMs) => ({
                  _tag: "RunSucceeded",
                  sequence: active.sequence,
                  finalizedAtMs,
                  data: runDataFromStore(id, program, store),
                  meta: store.meta
                }))
              )
            ),
          onStreamCompleteObserved: ({ summary, meta }) =>
            dispatchCurrentTimeRunMessage(registry, id, (observedAtMs) => ({
              _tag: "RunStreamCompleteObserved",
              sequence: active.sequence,
              observedAtMs,
              summary,
              meta
            })),
          runToken,
          signal: active.signal
        })
      )
    ).pipe(
      Effect.ensuring(resetProjectionDriverState(projectionDriver, registry)),
      Effect.matchEffect({
        onFailure: (error) =>
          dispatchCurrentTimeRunMessage(registry, id, (finalizedAtMs) => ({
            _tag: "RunFailed",
            sequence: active.sequence,
            finalizedAtMs,
            error
          })),
        onSuccess: () => Effect.void
      })
    )
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        releaseActiveRun(registry, id, active.token)
      })
    )
  )

export const startRun = (
  id: EntryId,
  ctx: AtomType.FnContext
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.gen(function*() {
    const registry = ctx.registry

    yield* interruptRunAuthority({ id, registry })

    const sequence = registry.get(surfaceAtom(id)).nextSequence
    const token = allocateRunToken(registry, id)
    const signal = yield* RunSignal.allocate({
      onPauseCheckpointReached: Effect.suspend(() =>
        runIsPaused(id, registry)
          ? dispatchCurrentTimeRunMessage(registry, id, (observedAtMs) => ({
            _tag: "RunPauseCheckpointReached",
            sequence,
            observedAtMs
          })).pipe(
            Effect.zipRight(syncCurrentProjectionFrameToControls(registry, id)),
            Effect.zipRight(setProjectionPlayback(projectionDriverFor(id), registry, false))
          )
          : Effect.void
      )
    })
    const fiber = yield* Effect.forkDaemon(runSurfaceExecution(id, { sequence, signal, token }, registry))

    registerActiveRun(registry, id, { fiber, sequence, signal, token })
  })
