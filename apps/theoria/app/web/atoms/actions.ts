import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Clock, Effect, Match, Option } from "effect"

import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import type { SurfaceId } from "../../contracts/id.js"
import type { Program, ProgramSourceScope } from "../../contracts/presentation.js"
import {
  applyEvidenceEventToStore,
  evidenceStoreFromSuccess,
  type EvidenceStoreState,
  evidenceStreamFromStore,
  hasActiveRunSequence,
  type RunControlActionKind,
  type RunMessage,
  type StageTab
} from "../state/types.js"

import type { SurfaceRuntimeServices } from "../runtime/proving-consumer-shared.js"
import {
  projectionDriverFor,
  resetProjectionDriverState,
  runOwnershipFor,
  setProjectionPlayback,
  snapshotProjectionDriver,
  surfaceRuntimeFor,
  surfaceRuntimeSnapshotFor,
  syncProjectionFrameToControls
} from "../runtime/surface-runtime.js"
import { dispatchRunMessage, modifySurface, preloadSurface, resetSurfaceEvidenceStore } from "./internal.js"
import { runEvidencePipeline } from "./run-evidence-pipeline.js"
import {
  type ActiveRun,
  activeRunFor,
  allocateRunToken,
  interruptActiveRun,
  makeRunSignal,
  pauseActiveRun,
  registerActiveRun,
  releaseActiveRun,
  resumeActiveRun
} from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"
import { appRuntime } from "./runtime.js"
import { surfaceAtom, surfaceEvidenceStoreAtom } from "./surface.js"

const pendingProgram: Program = {
  files: [{ source: "// pending", entry: "pending", language: "ts", name: "pending" }]
}

const runPackageName = (id: SurfaceId): string => id === "workflow-comparison" ? "@theoria/theoria-app" : id

const applyEvidenceEventToSurface = (
  registry: RunRegistry,
  id: SurfaceId,
  sequence: number,
  event: EvidenceEvent
): void =>
  Match.value(registry.get(surfaceAtom(id)).run).pipe(
    Match.when(
      (run) => hasActiveRunSequence(run, sequence),
      () => {
        registry.update(surfaceEvidenceStoreAtom(id), (store) => applyEvidenceEventToStore(store, event))
      }
    ),
    Match.orElse(() => undefined)
  )

const dispatchCurrentTimeRunMessage = (
  registry: RunRegistry,
  id: SurfaceId,
  buildMessage: (atMs: number) => RunMessage
): Effect.Effect<void, never, never> =>
  Clock.currentTimeMillis.pipe(
    Effect.tap((atMs) =>
      Effect.sync(() => {
        dispatchRunMessage(registry, id, buildMessage(atMs))
      })
    ),
    Effect.asVoid
  )

const runDataFromStore = (id: SurfaceId, program: Program, store: EvidenceStoreState) => {
  const stream = evidenceStreamFromStore(store)

  return {
    id,
    packageName: runPackageName(id),
    summary: stream.summary ?? "Run complete.",
    durationMs: stream.meta?.durationMs ?? 0,
    program,
    sections: stream.sections
  }
}

type RunningExecution = {
  readonly sequence: number
  readonly signal: ActiveRun["signal"]
  readonly token: number
}

const runIsPaused = (id: SurfaceId, registry: RunRegistry): boolean =>
  registry.get(surfaceAtom(id)).run.session.control === "paused"

const syncCurrentProjectionFrameToControls = (
  registry: RunRegistry,
  id: SurfaceId
): Effect.Effect<void, never, never> =>
  Effect.sync(() => registry.get(surfaceAtom(id)).run.session.localRunFrame).pipe(
    Effect.flatMap((localRunFrame) => syncProjectionFrameToControls(projectionDriverFor(id), registry, localRunFrame))
  )

const interruptRunAuthority = ({
  id,
  registry
}: {
  readonly id: SurfaceId
  readonly registry: RunRegistry
}): Effect.Effect<Option.Option<ActiveRun>, never, never> =>
  interruptActiveRun(id, registry).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed(Option.none()),
        onSome: (active) => {
          const projectionDriver = projectionDriverFor(id)

          return syncCurrentProjectionFrameToControls(registry, id).pipe(
            Effect.zipRight(setProjectionPlayback(projectionDriver, registry, false)),
            Effect.zipRight(resetProjectionDriverState(projectionDriver, registry)),
            Effect.as(Option.some(active))
          )
        }
      })
    )
  )

const runSurfaceExecution = (
  id: SurfaceId,
  active: RunningExecution,
  registry: RunRegistry
): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.gen(function*() {
    yield* preloadSurface(id, registry)
    const runtime = surfaceRuntimeFor(id)
    const runtimeSnapshot = surfaceRuntimeSnapshotFor(id, registry)

    if (runtimeSnapshot.runPlan === null) {
      return
    }

    const runPlan = runtimeSnapshot.runPlan

    const projectionDriver = projectionDriverFor(id)
    const projectionDriverSnapshot = snapshotProjectionDriver(projectionDriver, registry)

    const program = Match.value(registry.get(surfaceAtom(id)).preload).pipe(
      Match.tag("PreloadReady", ({ data }) => data.program),
      Match.orElse(() => pendingProgram)
    )

    modifySurface(registry, id, (s) => ({
      ...s,
      nextSequence: active.sequence + 1
    }))
    yield* dispatchCurrentTimeRunMessage(registry, id, (startedAtMs) => ({
      _tag: "RunStarted",
      token: active.token,
      sequence: active.sequence,
      ownership: runOwnershipFor(projectionDriver),
      startedAtMs,
      runPlan,
      localRunPlan: runtimeSnapshot.localRunPlan,
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

          const { data, meta } = yield* runWithMeta.value(runtimeSnapshot)
          const store = evidenceStoreFromSuccess({ data, meta })

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
          runToken: `${id}:${active.token}`,
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

const startRun = (id: SurfaceId, ctx: AtomType.FnContext): Effect.Effect<void, never, SurfaceRuntimeServices> =>
  Effect.gen(function*() {
    const registry = ctx.registry

    yield* interruptRunAuthority({ id, registry })

    const sequence = registry.get(surfaceAtom(id)).nextSequence
    const token = allocateRunToken(registry, id)
    const signal = yield* makeRunSignal({
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

const pauseRun = (id: SurfaceId, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
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

const resumeRun = (id: SurfaceId, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
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

const stopRun = (id: SurfaceId, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
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

const resetRun = (id: SurfaceId, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const projectionDriver = projectionDriverFor(id)

    yield* interruptRunAuthority({ id, registry: ctx.registry })
    yield* resetProjectionDriverState(projectionDriver, ctx.registry)
    yield* setProjectionPlayback(projectionDriver, ctx.registry, false)
    resetSurfaceEvidenceStore(ctx.registry, id)

    dispatchRunMessage(ctx.registry, id, { _tag: "RunReset" })
  })

type RunControlCommand = { readonly action: RunControlActionKind; readonly id: SurfaceId }

export const makeRunControlAtom = (runtime: typeof appRuntime) =>
  runtime.fn<RunControlCommand>()(
    ({ action, id }, ctx) =>
      Match.value(action).pipe(
        Match.when("run", () => startRun(id, ctx)),
        Match.when("pause", () => pauseRun(id, ctx)),
        Match.when("resume", () => resumeRun(id, ctx)),
        Match.when("stop", () => stopRun(id, ctx)),
        Match.orElse(() => resetRun(id, ctx))
      )
  )

export const makeRunDemoAtom = (runtime: typeof appRuntime) => runtime.fn<SurfaceId>()((id, ctx) => startRun(id, ctx))

export const runDemoAtom = makeRunDemoAtom(appRuntime)
export const controlRunAtom = makeRunControlAtom(appRuntime)

type StageTabSelection = { readonly id: SurfaceId; readonly tab: StageTab }

export const selectStageTabAtom = Atom.fnSync<StageTabSelection>()(
  ({ id, tab }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({ ...s, stageTab: tab }))
  }
)

type ProgramFileSelection = { readonly id: SurfaceId; readonly fileIndex: number }

export const selectProgramFileAtom = Atom.fnSync<ProgramFileSelection>()(
  ({ id, fileIndex }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({
      ...s,
      programFileIndex: fileIndex
    }))
  }
)

type ProgramSourceScopeSelection = { readonly id: SurfaceId; readonly scope: ProgramSourceScope }

export const selectProgramSourceScopeAtom = Atom.fnSync<ProgramSourceScopeSelection>()(
  ({ id, scope }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({
      ...s,
      programSourceScope: scope,
      programFileIndex: 0
    }))
  }
)
