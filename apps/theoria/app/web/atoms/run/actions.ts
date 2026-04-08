import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Clock, Effect, Match, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"
import type { EntryDraft } from "../../../contracts/entry/registry.js"
import { entryPresentationForId } from "../../../contracts/entry/routing.js"
import { applyEvidenceEventToStore, type EvidenceStoreState } from "../../../contracts/evidence/store.js"
import type { EvidenceEvent } from "../../../contracts/evidence/stream.js"
import type { Program, ProgramSourceScope } from "../../../contracts/presentation/program.js"
import { resolveEntryRunIdentityFromDraft } from "../../../contracts/study/run-plan.js"
import type { WorkflowComparisonId } from "../../../contracts/study/workflow/comparison/comparison.js"
import {
  effectiveWorkflowComparisonMode,
  makeWorkflowEntryControls,
  type WorkflowComparisonComparisonMode,
  type WorkflowComparisonExecutionLane,
  type WorkflowComparisonRuntimeProfile,
  type WorkflowComparisonSurfaceProfile
} from "../../../contracts/study/workflow/comparison/run.js"
import { evidenceStoreFromSuccess, evidenceStreamFromStore } from "../../state/evidence/stream.js"
import type { RunMessage } from "../../state/run/messages.js"
import { hasActiveRunSequence, type RunControlActionKind } from "../../state/run/types.js"
import type { StageTab } from "../../state/surface/state.js"

import type { SurfaceRuntimeServices } from "../../runtime/kernel/kind.js"
import {
  projectionDriverFor,
  resetProjectionDriverState,
  runOwnershipFor,
  setProjectionPlayback,
  snapshotProjectionDriver,
  surfaceRuntimeFor,
  surfaceRuntimeSnapshotFor,
  syncProjectionFrameToControls
} from "../../runtime/kernel/surface-runtime.js"
import type { RunRegistry } from "../run-registry-context.js"
import { appRuntime } from "../runtime.js"
import { dispatchRunMessage, modifySurface, preloadSurface, resetSurfaceEvidenceStore } from "../surface/internal.js"
import { surfaceAtom, surfaceEvidenceStoreAtom } from "../surface/state.js"
import { runEvidencePipeline } from "./evidence-pipeline.js"
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
} from "./lifecycle.js"

const pendingProgram: Program = {
  files: [{ source: "// pending", entry: "pending", language: "ts", name: "pending" }]
}

const workflowEntryId = "workflow"
type WorkflowEntryDraft = Extract<EntryDraft, { readonly entryId: "workflow" }>

const runPackageName = (id: EntryId): string => entryPresentationForId(id).packageName

const updateWorkflowDraft = (
  ctx: AtomType.FnContext,
  f: (draft: WorkflowEntryDraft) => WorkflowEntryDraft
): void => {
  modifySurface(ctx.registry, workflowEntryId, (surface) =>
    surface.draft.entryId !== workflowEntryId
      ? surface
      : {
        ...surface,
        draft: f(surface.draft)
      })
}

const updateWorkflowControls = (
  ctx: AtomType.FnContext,
  f: (controls: WorkflowEntryDraft["controls"]) => {
    readonly comparisonMode?: WorkflowComparisonComparisonMode
    readonly lane?: WorkflowComparisonExecutionLane
    readonly optimize?: boolean
    readonly runtimeProfile?: WorkflowComparisonRuntimeProfile
    readonly surfaceProfile?: WorkflowComparisonSurfaceProfile
  }
): void => {
  updateWorkflowDraft(ctx, (draft) => {
    const nextControls = f(draft.controls)

    return {
      ...draft,
      controls: makeWorkflowEntryControls({
        lane: nextControls.lane ?? draft.controls.lane,
        optimize: nextControls.optimize ?? draft.controls.optimize,
        comparisonMode: nextControls.comparisonMode ?? draft.controls.comparisonMode,
        runtimeProfile: nextControls.runtimeProfile ?? draft.controls.runtimeProfile,
        surfaceProfile: nextControls.surfaceProfile ?? draft.controls.surfaceProfile
      })
    }
  })
}

const applyEvidenceEventToSurface = (
  registry: RunRegistry,
  id: EntryId,
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
  id: EntryId,
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

const runDataFromStore = (id: EntryId, program: Program, store: EvidenceStoreState) => {
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

const runIsPaused = (id: EntryId, registry: RunRegistry): boolean =>
  registry.get(surfaceAtom(id)).run.session.control === "paused"

const syncCurrentProjectionFrameToControls = (
  registry: RunRegistry,
  id: EntryId
): Effect.Effect<void, never, never> =>
  Effect.sync(() => registry.get(surfaceAtom(id)).run.session.localRunFrame).pipe(
    Effect.flatMap((localRunFrame) => syncProjectionFrameToControls(projectionDriverFor(id), registry, localRunFrame))
  )

const interruptRunAuthority = ({
  id,
  registry
}: {
  readonly id: EntryId
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
  id: EntryId,
  active: RunningExecution,
  registry: RunRegistry
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
    const identity = yield* resolveEntryRunIdentityFromDraft({ draft, runToken })

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

const startRun = (id: EntryId, ctx: AtomType.FnContext): Effect.Effect<void, never, SurfaceRuntimeServices> =>
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

const pauseRun = (id: EntryId, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
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

const resumeRun = (id: EntryId, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
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

const stopRun = (id: EntryId, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
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

const resetRun = (id: EntryId, ctx: AtomType.FnContext): Effect.Effect<void, never, never> =>
  Effect.gen(function*() {
    const projectionDriver = projectionDriverFor(id)

    yield* interruptRunAuthority({ id, registry: ctx.registry })
    yield* resetProjectionDriverState(projectionDriver, ctx.registry)
    yield* setProjectionPlayback(projectionDriver, ctx.registry, false)
    resetSurfaceEvidenceStore(ctx.registry, id)

    dispatchRunMessage(ctx.registry, id, { _tag: "RunReset" })
  })

type RunControlCommand = { readonly action: RunControlActionKind; readonly id: EntryId }

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

export const makeRunDemoAtom = (runtime: typeof appRuntime) => runtime.fn<EntryId>()((id, ctx) => startRun(id, ctx))

export const runDemoAtom = makeRunDemoAtom(appRuntime)
export const controlRunAtom = makeRunControlAtom(appRuntime)

type StageTabSelection = { readonly id: EntryId; readonly tab: StageTab }

export const selectStageTabAtom = Atom.fnSync<StageTabSelection>()(
  ({ id, tab }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({ ...s, stageTab: tab }))
  }
)

type ProgramFileSelection = { readonly id: EntryId; readonly fileIndex: number }

export const selectProgramFileAtom = Atom.fnSync<ProgramFileSelection>()(
  ({ id, fileIndex }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({
      ...s,
      programFileIndex: fileIndex
    }))
  }
)

type ProgramSourceScopeSelection = { readonly id: EntryId; readonly scope: ProgramSourceScope }

export const selectProgramSourceScopeAtom = Atom.fnSync<ProgramSourceScopeSelection>()(
  ({ id, scope }, ctx) => {
    modifySurface(ctx.registry, id, (s) => ({
      ...s,
      programSourceScope: scope,
      programFileIndex: 0
    }))
  }
)

export const selectWorkflowSeedAtom = Atom.fnSync<WorkflowComparisonId>()((seedId, ctx) => {
  updateWorkflowDraft(ctx, (draft) => ({
    ...draft,
    seedId
  }))
})

export const selectWorkflowExecutionLaneAtom = Atom.fnSync<WorkflowComparisonExecutionLane>()((lane, ctx) => {
  updateWorkflowControls(ctx, () => ({ lane }))
})

export const selectWorkflowOptimizeAtom = Atom.fnSync<boolean>()((optimize, ctx) => {
  updateWorkflowControls(ctx, (controls) => ({
    optimize,
    comparisonMode: effectiveWorkflowComparisonMode({
      comparisonMode: controls.comparisonMode,
      optimize
    })
  }))
})

export const selectWorkflowComparisonModeAtom = Atom.fnSync<WorkflowComparisonComparisonMode>()(
  (comparisonMode, ctx) => {
    updateWorkflowControls(ctx, (controls) => ({
      comparisonMode,
      optimize: comparisonMode === "search-winner" ? true : controls.optimize
    }))
  }
)

export const selectWorkflowRuntimeProfileAtom = Atom.fnSync<WorkflowComparisonRuntimeProfile>()(
  (runtimeProfile, ctx) => {
    updateWorkflowControls(ctx, () => ({ runtimeProfile }))
  }
)

export const selectWorkflowSurfaceProfileAtom = Atom.fnSync<WorkflowComparisonSurfaceProfile>()(
  (surfaceProfile, ctx) => {
    updateWorkflowControls(ctx, () => ({ surfaceProfile }))
  }
)
