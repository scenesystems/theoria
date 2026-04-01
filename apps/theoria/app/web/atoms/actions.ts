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

import { dispatchRunMessage, modifySurface, preloadSurface, resetSurfaceEvidenceStore } from "./internal.js"
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
import { appRuntime } from "./runtime.js"
import { surfaceAtom, surfaceEvidenceStoreAtom } from "./surface.js"

const pendingProgram: Program = {
  files: [{ source: "// pending", entry: "pending", language: "ts", name: "pending" }]
}

const applyEvidenceEventToSurface = (ctx: AtomType.FnContext, id: Id, sequence: number, event: EvidenceEvent): void =>
  Match.value(ctx(surfaceAtom(id)).run).pipe(
    Match.when(
      (run) => hasActiveRunSequence(run, sequence),
      () => {
        ctx.set(surfaceEvidenceStoreAtom(id), applyEvidenceEventToStore(ctx(surfaceEvidenceStoreAtom(id)), event))
      }
    ),
    Match.orElse(() => undefined)
  )

const dispatchCurrentTimeRunMessage = (
  ctx: AtomType.FnContext,
  id: Id,
  buildMessage: (atMs: number) => RunMessage
): Effect.Effect<void, never, never> =>
  Clock.currentTimeMillis.pipe(
    Effect.tap((atMs) =>
      Effect.sync(() => {
        dispatchRunMessage(ctx, id, buildMessage(atMs))
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

const runDemoExecution = (
  id: Id,
  active: RunningExecution,
  ctx: AtomType.FnContext
): Effect.Effect<void, never, DemoClient> =>
  Effect.gen(function*() {
    yield* preloadSurface(id, ctx)
    const localDriver = localDriverFor(id)
    const localDriverSnapshot = snapshotLocalDriver(localDriver, ctx)

    const program = Match.value(ctx(surfaceAtom(id)).preload).pipe(
      Match.tag("PreloadReady", ({ data }) => data.program),
      Match.orElse(() => pendingProgram)
    )

    modifySurface(ctx, id, (s) => ({
      ...s,
      nextSequence: active.sequence + 1
    }))
    yield* dispatchCurrentTimeRunMessage(ctx, id, (startedAtMs) => ({
      _tag: "RunStarted",
      token: active.token,
      sequence: active.sequence,
      ownership: runOwnershipFor(localDriver),
      startedAtMs,
      localRunPlan: localDriverSnapshot.localRunPlan,
      program
    }))
    resetSurfaceEvidenceStore(ctx, id)

    yield* runEvidencePipeline({
      ctx,
      id,
      localDriver,
      localDriverSnapshot,
      signal: active.signal,
      onEvent: (event) =>
        Effect.sync(() => {
          applyEvidenceEventToSurface(ctx, id, active.sequence, event)
        }),
      onFrame: (frame) =>
        Effect.sync(() => {
          dispatchRunMessage(ctx, id, {
            _tag: "RunFrameUpdated",
            sequence: active.sequence,
            frame
          })
        }),
      onLocalCompleted: () =>
        dispatchCurrentTimeRunMessage(ctx, id, (observedAtMs) => ({
          _tag: "RunLocalCompleted",
          sequence: active.sequence,
          observedAtMs
        })),
      onReadyForFinalization: (store) =>
        dispatchCurrentTimeRunMessage(ctx, id, (finalizedAtMs) => ({
          _tag: "RunSucceeded",
          sequence: active.sequence,
          finalizedAtMs,
          data: runDataFromStore(id, program, store),
          meta: store.meta
        })),
      onServerCompleted: ({ summary, meta }) =>
        dispatchCurrentTimeRunMessage(ctx, id, (observedAtMs) => ({
          _tag: "RunServerCompleted",
          sequence: active.sequence,
          observedAtMs,
          summary,
          meta
        }))
    }).pipe(
      Effect.matchEffect({
        onFailure: (error) =>
          dispatchCurrentTimeRunMessage(ctx, id, (finalizedAtMs) => ({
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
        releaseActiveRun(ctx, id, active.token)
      })
    )
  )

const startRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, DemoClient> =>
  Effect.gen(function*() {
    yield* interruptActiveRun(id, ctx)

    const sequence = ctx(surfaceAtom(id)).nextSequence
    const token = allocateRunToken(ctx, id)
    const signal = yield* makeRunSignal({
      onPauseCheckpointReached: dispatchCurrentTimeRunMessage(ctx, id, (observedAtMs) => ({
        _tag: "RunPauseCheckpointReached",
        sequence,
        observedAtMs
      }))
    })
    const fiber = yield* Effect.forkDaemon(runDemoExecution(id, { sequence, signal, token }, ctx))

    registerActiveRun(ctx, id, { fiber, sequence, signal, token })
  })

const pauseRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  pauseActiveRun(ctx, id).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (active) =>
          dispatchCurrentTimeRunMessage(ctx, id, (requestedAtMs) => ({
            _tag: "RunPaused",
            sequence: active.sequence,
            requestedAtMs
          }))
      })
    )
  )

const resumeRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  resumeActiveRun(ctx, id).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.void,
        onSome: (active) =>
          Effect.sync(() => {
            dispatchRunMessage(ctx, id, {
              _tag: "RunResumed",
              sequence: active.sequence
            })
          })
      })
    )
  )

const stopRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  Option.match(activeRunFor(ctx, id), {
    onNone: () => Effect.void,
    onSome: (active) =>
      Effect.gen(function*() {
        dispatchRunMessage(ctx, id, {
          _tag: "RunStopping",
          sequence: active.sequence
        })

        yield* stopActiveRun(id, ctx)

        yield* dispatchCurrentTimeRunMessage(ctx, id, (finalizedAtMs) => ({
          _tag: "RunStopped",
          sequence: active.sequence,
          finalizedAtMs
        }))
      })
  })

const resetRun = (id: Id, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    yield* interruptActiveRun(id, ctx)
    yield* resetLocalDriverState(localDriverFor(id), ctx)
    resetSurfaceEvidenceStore(ctx, id)

    dispatchRunMessage(ctx, id, { _tag: "RunReset" })
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
    modifySurface(ctx, id, (s) => ({ ...s, stageTab: tab }))
  }
)

type ProgramFileSelection = { readonly id: Id; readonly fileIndex: number }

export const selectProgramFileAtom = Atom.fnSync<ProgramFileSelection>()(
  ({ id, fileIndex }, ctx) => {
    modifySurface(ctx, id, (s) => ({
      ...s,
      programFileIndex: fileIndex
    }))
  }
)

type ProgramSourceScopeSelection = { readonly id: Id; readonly scope: ProgramSourceScope }

export const selectProgramSourceScopeAtom = Atom.fnSync<ProgramSourceScopeSelection>()(
  ({ id, scope }, ctx) => {
    modifySurface(ctx, id, (s) => ({
      ...s,
      programSourceScope: scope,
      programFileIndex: 0
    }))
  }
)
