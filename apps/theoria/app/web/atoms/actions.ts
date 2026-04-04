import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Clock, Effect, Match, Option } from "effect"

import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import type { Id } from "../../contracts/id.js"
import type { Program, ProgramSourceScope } from "../../contracts/presentation.js"
import type { DemoClient } from "../services/DemoClient.js"
import {
  applyEvidenceEventToStore,
  type EvidenceStoreState,
  evidenceStreamFromStore,
  hasActiveRunSequence,
  type RunControlActionKind,
  type RunMessage,
  type StageTab
} from "../state/types.js"

import { setAnimationPlayback, syncAnimationFrameToControls } from "./animation.js"
import { dispatchRunMessage, modifySurface, preloadSurface, resetSurfaceEvidenceStore } from "./internal.js"
import { setOptimizationAnimationPlayback } from "./optimization-animation.js"
import { setPowerAnimationPlayback, syncPowerFrameToControls } from "./power-animation.js"
import {
  localDriverFor,
  resetLocalDriverState,
  runEvidencePipeline,
  runOwnershipFor,
  snapshotLocalDriver
} from "./run-evidence-pipeline.js"
import {
  type ActiveRun,
  activeRunFor,
  allocateRunToken,
  interruptActiveRun,
  makeRunSignal,
  pauseActiveRun,
  registerActiveRun,
  releaseActiveRun,
  resumeActiveRun,
  stopActiveRun
} from "./run-lifecycle.js"
import type { RunRegistry } from "./run-registry-context.js"
import { appRuntime } from "./runtime.js"
import { surfaceAtom, surfaceEvidenceStoreAtom } from "./surface.js"

const pendingProgram: Program = {
  files: [{ source: "// pending", entry: "pending", language: "ts", name: "pending" }]
}

const applyEvidenceEventToSurface = (registry: RunRegistry, id: Id, sequence: number, event: EvidenceEvent): void =>
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
  id: Id,
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

const runDataFromStore = (id: Id, program: Program, store: EvidenceStoreState) => {
  const stream = evidenceStreamFromStore(store)

  return {
    id,
    packageName: id,
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

const runIsPaused = (id: Id, registry: RunRegistry): boolean => registry.get(surfaceAtom(id)).run._tag === "RunPaused"

const syncEffectTextPlayback = ({
  registry,
  id,
  isAnimating
}: {
  readonly registry: RunRegistry
  readonly id: Id
  readonly isAnimating: boolean
}): Effect.Effect<void, never, never> =>
  id === "effect-text"
    ? setAnimationPlayback(registry, isAnimating)
    : Effect.void

const syncLocalAnimationPlayback = ({
  registry,
  id,
  isAnimating
}: {
  readonly registry: RunRegistry
  readonly id: Id
  readonly isAnimating: boolean
}): Effect.Effect<void, never, never> =>
  Match.value(id).pipe(
    Match.when("effect-text", () => syncEffectTextPlayback({ registry, id, isAnimating })),
    Match.when("effect-search", () => setOptimizationAnimationPlayback(registry, isAnimating)),
    Match.when("effect-math", () => setPowerAnimationPlayback(registry, isAnimating)),
    Match.orElse(() => Effect.void)
  )

const syncCurrentEffectTextFrameToControls = (
  registry: RunRegistry,
  id: Id
): Effect.Effect<void, never, never> =>
  Effect.sync(() => registry.get(surfaceAtom(id)).run.session.localRunFrame).pipe(
    Effect.flatMap((localRunFrame) =>
      id === "effect-text" && localRunFrame?._tag === "effect-text"
        ? syncAnimationFrameToControls(registry, localRunFrame)
        : Effect.void
    )
  )

const syncCurrentLocalRunFrameToControls = (
  registry: RunRegistry,
  id: Id
): Effect.Effect<void, never, never> =>
  Effect.sync(() => registry.get(surfaceAtom(id)).run.session.localRunFrame).pipe(
    Effect.flatMap((localRunFrame) =>
      Match.value(id).pipe(
        Match.when("effect-text", () => syncCurrentEffectTextFrameToControls(registry, id)),
        Match.when("effect-math", () =>
          localRunFrame?._tag === "effect-math"
            ? syncPowerFrameToControls(registry, localRunFrame)
            : Effect.void),
        Match.orElse(() => Effect.void)
      )
    )
  )

const runDemoExecution = (
  id: Id,
  active: RunningExecution,
  registry: RunRegistry
): Effect.Effect<void, never, DemoClient> =>
  Effect.gen(function*() {
    yield* preloadSurface(id, registry)
    const localDriver = localDriverFor(id)
    const localDriverSnapshot = snapshotLocalDriver(localDriver, registry)

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
      ownership: runOwnershipFor(localDriver),
      startedAtMs,
      localRunPlan: localDriverSnapshot.localRunPlan,
      program
    }))
    resetSurfaceEvidenceStore(registry, id)

    yield* runEvidencePipeline({
      registry,
      id,
      localDriver,
      localDriverSnapshot,
      signal: active.signal,
      onCue: () => Effect.void,
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
      onLocalCompleted: () =>
        dispatchCurrentTimeRunMessage(registry, id, (observedAtMs) => ({
          _tag: "RunLocalCompleted",
          sequence: active.sequence,
          observedAtMs
        })),
      onReadyForFinalization: (store) =>
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
      onServerCompleted: ({ summary, meta }) =>
        dispatchCurrentTimeRunMessage(registry, id, (observedAtMs) => ({
          _tag: "RunServerCompleted",
          sequence: active.sequence,
          observedAtMs,
          summary,
          meta
        }))
    }).pipe(
      Effect.ensuring(resetLocalDriverState(localDriver, registry)),
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

const startRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, DemoClient> =>
  Effect.gen(function*() {
    const registry = ctx.registry

    yield* interruptActiveRun(id, registry)

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
            Effect.zipRight(syncCurrentLocalRunFrameToControls(registry, id)),
            Effect.zipRight(syncLocalAnimationPlayback({ registry, id, isAnimating: false }))
          )
          : Effect.void
      )
    })
    const fiber = yield* Effect.forkDaemon(runDemoExecution(id, { sequence, signal, token }, registry))

    registerActiveRun(registry, id, { fiber, sequence, signal, token })
  })

const pauseRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  pauseActiveRun(ctx.registry, id).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (active) =>
          syncCurrentLocalRunFrameToControls(ctx.registry, id).pipe(
            Effect.zipRight(syncLocalAnimationPlayback({ registry: ctx.registry, id, isAnimating: false })),
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

const resumeRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  resumeActiveRun(ctx.registry, id).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (active) =>
          syncLocalAnimationPlayback({ registry: ctx.registry, id, isAnimating: true }).pipe(
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

const stopRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  Option.match(activeRunFor(ctx.registry, id), {
    onNone: () => Effect.void,
    onSome: (active) =>
      Effect.gen(function*() {
        yield* dispatchCurrentTimeRunMessage(ctx.registry, id, (requestedAtMs) => ({
          _tag: "RunStopping",
          sequence: active.sequence,
          requestedAtMs
        }))

        yield* syncCurrentLocalRunFrameToControls(ctx.registry, id)
        yield* syncLocalAnimationPlayback({ registry: ctx.registry, id, isAnimating: false })
        yield* stopActiveRun(id, ctx.registry)

        yield* dispatchCurrentTimeRunMessage(ctx.registry, id, (finalizedAtMs) => ({
          _tag: "RunStopped",
          sequence: active.sequence,
          finalizedAtMs
        }))
      })
  })

const resetRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    yield* interruptActiveRun(id, ctx.registry)
    yield* resetLocalDriverState(localDriverFor(id), ctx.registry)
    resetSurfaceEvidenceStore(ctx.registry, id)

    dispatchRunMessage(ctx.registry, id, { _tag: "RunReset" })
  })

type RunControlCommand = { readonly action: RunControlActionKind; readonly id: Id }

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

export const makeRunDemoAtom = (runtime: typeof appRuntime) => runtime.fn<Id>()((id, ctx) => startRun(id, ctx))

export const runDemoAtom = makeRunDemoAtom(appRuntime)
export const controlRunAtom = makeRunControlAtom(appRuntime)

type StageTabSelection = { readonly id: Id; readonly tab: StageTab }

export const selectStageTabAtom = Atom.fnSync<StageTabSelection>()(
  ({ id, tab }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({ ...s, stageTab: tab }))
  }
)

type ProgramFileSelection = { readonly id: Id; readonly fileIndex: number }

export const selectProgramFileAtom = Atom.fnSync<ProgramFileSelection>()(
  ({ id, fileIndex }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({
      ...s,
      programFileIndex: fileIndex
    }))
  }
)

type ProgramSourceScopeSelection = { readonly id: Id; readonly scope: ProgramSourceScope }

export const selectProgramSourceScopeAtom = Atom.fnSync<ProgramSourceScopeSelection>()(
  ({ id, scope }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({
      ...s,
      programSourceScope: scope,
      programFileIndex: 0
    }))
  }
)
