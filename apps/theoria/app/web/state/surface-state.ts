import { Match, Option } from "effect"

import type { DemoError } from "../../contracts/demo-error.js"
import type { Metadata } from "../../contracts/envelope.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import type { EvidenceSection } from "../../contracts/evidence.js"
import type { Id } from "../../contracts/id.js"
import type { Program, ProgramSourceScope } from "../../contracts/presentation.js"
import type { ProgramPreview } from "../../contracts/program-preview.js"
import type { RunData } from "../../contracts/run.js"
import type { LocalRunFrame, LocalRunPlan } from "./local-run.js"

export type { LocalRunFrame, LocalRunPlan } from "./local-run.js"

export type StageTab = "interactive" | "evidence"
export type RunControlActionKind = "run" | "pause" | "resume" | "stop" | "reset"

export type PreloadState =
  | { readonly _tag: "PreloadIdle" }
  | { readonly _tag: "PreloadLoading" }
  | { readonly _tag: "PreloadReady"; readonly data: ProgramPreview }
  | { readonly _tag: "PreloadFailed"; readonly error: DemoError }

export type EvidenceStreamState = {
  readonly sections: ReadonlyArray<EvidenceSection>
  readonly complete: boolean
  readonly summary: string | null
  readonly meta: Metadata | null
}

export type EvidenceStoreState = {
  readonly nextSectionId: number
  readonly sectionOrder: ReadonlyArray<string>
  readonly sectionsById: Readonly<Record<string, EvidenceSection>>
  readonly sectionIdsByTitle: Readonly<Record<string, string>>
  readonly complete: boolean
  readonly summary: string | null
  readonly meta: Metadata | null
}

export type EvidenceStatusState = {
  readonly complete: boolean
  readonly sectionCount: number
}

export type RunControlState = "idle" | "running" | "paused" | "stopping"
export type RunOutcome = "none" | "stopped" | "failed" | "succeeded"

export type RunOwnership = {
  readonly localDriver: boolean
  readonly serverStream: boolean
}

export type RunBoundaryCompletionState = "inactive" | "pending" | "completed"

export type RunServerCompletion = {
  readonly state: RunBoundaryCompletionState
  readonly summary: string | null
  readonly meta: Metadata | null
}

export type RunLocalCompletion = {
  readonly state: RunBoundaryCompletionState
}

export type RunCompletion = {
  readonly server: RunServerCompletion
  readonly local: RunLocalCompletion
}

export type RunRuntimeTelemetryKind =
  | "pause-requested"
  | "checkpoint-reached"
  | "server-completed"
  | "local-completed"
  | "run-finalized"

export type RunRuntimeTelemetryEvent = {
  readonly kind: RunRuntimeTelemetryKind
  readonly atMs: number
  readonly detail: string | null
}

export type RunRuntimeTelemetryState = {
  readonly startedAtMs: number | null
  readonly events: ReadonlyArray<RunRuntimeTelemetryEvent>
}

export type RunSession = {
  readonly token: number | null
  readonly sequence: number | null
  readonly control: RunControlState
  readonly outcome: RunOutcome
  readonly ownership: RunOwnership
  readonly completion: RunCompletion
  readonly telemetry: RunRuntimeTelemetryState
  readonly localRunPlan: LocalRunPlan | null
  readonly localRunFrame: LocalRunFrame | null
  readonly program: Program | null
}

type ActiveRunSession = RunSession & {
  readonly token: number
  readonly sequence: number
  readonly program: Program
}

type InFlightRunSession = ActiveRunSession & {
  readonly outcome: "none"
}

type RunningRunSession = InFlightRunSession & {
  readonly control: "running"
}

type PausedRunSession = InFlightRunSession & {
  readonly control: "paused"
}

type StoppingRunSession = InFlightRunSession & {
  readonly control: "stopping"
}

type TerminalRunSession = ActiveRunSession & {
  readonly control: "idle"
  readonly outcome: Exclude<RunOutcome, "none">
}

export type RunInFlightState =
  | {
    readonly _tag: "RunRunning"
    readonly session: RunningRunSession
    readonly sequence: number
    readonly program: Program
  }
  | {
    readonly _tag: "RunPaused"
    readonly session: PausedRunSession
    readonly sequence: number
    readonly program: Program
  }
  | {
    readonly _tag: "RunStopping"
    readonly session: StoppingRunSession
    readonly sequence: number
    readonly program: Program
  }

export type RunState =
  | { readonly _tag: "RunIdle"; readonly session: RunSession }
  | RunInFlightState
  | {
    readonly _tag: "RunFailed"
    readonly session: TerminalRunSession & { readonly outcome: "failed" }
    readonly sequence: number
    readonly program: Program
    readonly error: DemoError
  }
  | {
    readonly _tag: "RunStopped"
    readonly session: TerminalRunSession & { readonly outcome: "stopped" }
    readonly sequence: number
    readonly program: Program
  }
  | {
    readonly _tag: "RunSuccess"
    readonly session: TerminalRunSession & { readonly outcome: "succeeded" }
    readonly sequence: number
    readonly data: RunData
    readonly meta: Metadata | null
  }

export type RunPhase = "idle" | "running" | "paused" | "stopping" | "stopped" | "failed" | "success"

export type SurfaceState = {
  readonly id: Id
  readonly stageTab: StageTab
  readonly preload: PreloadState
  readonly run: RunState
  readonly nextSequence: number
  readonly programSourceScope: ProgramSourceScope
  readonly programFileIndex: number
}

export const emptyEvidenceStoreState: EvidenceStoreState = {
  nextSectionId: 1,
  sectionOrder: [],
  sectionsById: {},
  sectionIdsByTitle: {},
  complete: false,
  summary: null,
  meta: null
}

export const emptyEvidenceStreamState: EvidenceStreamState = {
  sections: [],
  complete: false,
  summary: null,
  meta: null
}

export const emptyEvidenceStatusState: EvidenceStatusState = {
  complete: false,
  sectionCount: 0
}

const nextEvidenceSectionId = (state: EvidenceStoreState): string => `section-${state.nextSectionId}`

const appendSectionToStore = (state: EvidenceStoreState, section: EvidenceSection): EvidenceStoreState => {
  const sectionId = nextEvidenceSectionId(state)
  const existingId = state.sectionIdsByTitle[section.title]

  return Option.fromNullable(existingId).pipe(
    Option.match({
      onNone: () => ({
        ...state,
        nextSectionId: state.nextSectionId + 1,
        sectionOrder: [...state.sectionOrder, sectionId],
        sectionsById: {
          ...state.sectionsById,
          [sectionId]: section
        },
        sectionIdsByTitle: {
          ...state.sectionIdsByTitle,
          [section.title]: sectionId
        }
      }),
      onSome: () => ({
        ...state,
        nextSectionId: state.nextSectionId + 1,
        sectionOrder: [...state.sectionOrder, sectionId],
        sectionsById: {
          ...state.sectionsById,
          [sectionId]: section
        }
      })
    })
  )
}

const upsertSectionInStore = (state: EvidenceStoreState, section: EvidenceSection): EvidenceStoreState => {
  const existingId = state.sectionIdsByTitle[section.title]

  return Option.fromNullable(existingId).pipe(
    Option.match({
      onNone: () => appendSectionToStore(state, section),
      onSome: (sectionId) => ({
        ...state,
        sectionsById: {
          ...state.sectionsById,
          [sectionId]: section
        }
      })
    })
  )
}

const upsertSection = (
  sections: ReadonlyArray<EvidenceSection>,
  section: EvidenceSection
): ReadonlyArray<EvidenceSection> => {
  const index = sections.findIndex((current) => current.title === section.title)

  return index === -1
    ? [...sections, section]
    : sections.map((current, currentIndex) => (currentIndex === index ? section : current))
}

export const applyEvidenceEventToStore = (state: EvidenceStoreState, event: EvidenceEvent): EvidenceStoreState =>
  Match.value(event).pipe(
    Match.tag("SectionAppend", ({ section }) => appendSectionToStore(state, section)),
    Match.tag("SectionUpsert", ({ section }) => upsertSectionInStore(state, section)),
    Match.tag("StreamComplete", ({ summary, meta }) => ({
      ...state,
      complete: true,
      summary,
      meta
    })),
    Match.orElse(() => state)
  )

const applyEvidenceEventToStream = (state: EvidenceStreamState, event: EvidenceEvent): EvidenceStreamState =>
  Match.value(event).pipe(
    Match.tag("SectionAppend", ({ section }) => ({
      ...state,
      sections: [...state.sections, section]
    })),
    Match.tag("SectionUpsert", ({ section }) => ({
      ...state,
      sections: upsertSection(state.sections, section)
    })),
    Match.tag("StreamComplete", ({ summary, meta }) => ({
      ...state,
      complete: true,
      summary,
      meta
    })),
    Match.orElse(() => state)
  )

const isEvidenceStoreState = (
  state: EvidenceStoreState | EvidenceStreamState
): state is EvidenceStoreState => "sectionOrder" in state

export function applyEvidenceEvent(state: EvidenceStoreState, event: EvidenceEvent): EvidenceStoreState
export function applyEvidenceEvent(state: EvidenceStreamState, event: EvidenceEvent): EvidenceStreamState
export function applyEvidenceEvent(
  state: EvidenceStoreState | EvidenceStreamState,
  event: EvidenceEvent
): EvidenceStoreState | EvidenceStreamState {
  return isEvidenceStoreState(state)
    ? applyEvidenceEventToStore(state, event)
    : applyEvidenceEventToStream(state, event)
}

export const evidenceSectionsFromStore = (state: EvidenceStoreState): ReadonlyArray<EvidenceSection> =>
  state.sectionOrder.flatMap((sectionId) => {
    const section = state.sectionsById[sectionId]
    return Option.fromNullable(section).pipe(
      Option.match({
        onNone: () => [],
        onSome: (value) => [value]
      })
    )
  })

export const evidenceStatusFromStore = (state: EvidenceStoreState): EvidenceStatusState => ({
  complete: state.complete,
  sectionCount: state.sectionOrder.length
})

export const evidenceStatusFromStream = (state: EvidenceStreamState): EvidenceStatusState => ({
  complete: state.complete,
  sectionCount: state.sections.length
})

export const evidenceStreamFromStore = (state: EvidenceStoreState): EvidenceStreamState => ({
  sections: evidenceSectionsFromStore(state),
  complete: state.complete,
  summary: state.summary,
  meta: state.meta
})

export const evidenceStreamFromSuccess = ({
  data,
  meta
}: {
  readonly data: RunData
  readonly meta: Metadata | null
}): EvidenceStreamState => ({
  sections: data.sections,
  complete: true,
  summary: data.summary,
  meta
})

export const evidenceStoreFromSuccess = ({
  data,
  meta
}: {
  readonly data: RunData
  readonly meta: Metadata | null
}): EvidenceStoreState => {
  const stateWithSections = data.sections.reduce(appendSectionToStore, emptyEvidenceStoreState)

  return {
    ...stateWithSections,
    complete: true,
    summary: data.summary,
    meta
  }
}

export const evidenceStreamFromRunState = (run: RunState): EvidenceStreamState =>
  Match.value(run).pipe(
    Match.tag("RunSuccess", ({ data, meta }) => evidenceStreamFromSuccess({ data, meta })),
    Match.orElse(() => emptyEvidenceStreamState)
  )

export const evidenceStoreFromRunState = (run: RunState): EvidenceStoreState =>
  Match.value(run).pipe(
    Match.tag("RunSuccess", ({ data, meta }) => evidenceStoreFromSuccess({ data, meta })),
    Match.orElse(() => emptyEvidenceStoreState)
  )

const isBoundaryCompletionPending = (state: RunBoundaryCompletionState): boolean => state === "pending"

const isBoundaryCompletionCompleted = (state: RunBoundaryCompletionState): boolean => state === "completed"

const runCompletionReady = (completion: RunCompletion): boolean =>
  !isBoundaryCompletionPending(completion.server.state) && !isBoundaryCompletionPending(completion.local.state)

export const runHasServerCompletion = (run: RunState): boolean =>
  isBoundaryCompletionCompleted(run.session.completion.server.state)

export const runHasLocalCompletion = (run: RunState): boolean =>
  isBoundaryCompletionCompleted(run.session.completion.local.state)

export const runAwaitsServerCompletion = (run: RunState): boolean =>
  isBoundaryCompletionPending(run.session.completion.server.state)

export const runAwaitsLocalCompletion = (run: RunState): boolean =>
  isBoundaryCompletionPending(run.session.completion.local.state)

export const runServerCompletionSummary = (run: RunState): string | null => run.session.completion.server.summary

export const runPhase = (run: RunState): RunPhase =>
  Match.value(run.session.outcome).pipe(
    Match.withReturnType<RunPhase>(),
    Match.when("stopped", () => "stopped"),
    Match.when("failed", () => "failed"),
    Match.when("succeeded", () => "success"),
    Match.orElse(() =>
      Match.value(run.session.control).pipe(
        Match.withReturnType<RunPhase>(),
        Match.when("running", () => "running"),
        Match.when("paused", () => "paused"),
        Match.when("stopping", () => "stopping"),
        Match.orElse(() => "idle")
      )
    )
  )

export const hasActiveRunSequence = (run: RunState, sequence: number): boolean =>
  run.session.sequence === sequence && run.session.outcome === "none" && run.session.control !== "idle"

export const programFromRunState = (run: RunState): Program | null =>
  Match.value(run).pipe(
    Match.tag("RunRunning", ({ program }) => program),
    Match.tag("RunPaused", ({ program }) => program),
    Match.tag("RunStopping", ({ program }) => program),
    Match.tag("RunFailed", ({ program }) => program),
    Match.tag("RunStopped", ({ program }) => program),
    Match.tag("RunSuccess", ({ data }) => data.program),
    Match.orElse(() => null)
  )

const emptyRunOwnership: RunOwnership = {
  localDriver: false,
  serverStream: false
}

const inactiveRunCompletion: RunCompletion = {
  server: {
    state: "inactive",
    summary: null,
    meta: null
  },
  local: {
    state: "inactive"
  }
}

const emptyRunRuntimeTelemetryState: RunRuntimeTelemetryState = {
  startedAtMs: null,
  events: []
}

const startedRunRuntimeTelemetryState = (startedAtMs: number): RunRuntimeTelemetryState => ({
  startedAtMs,
  events: []
})

const appendRunRuntimeTelemetryEvent = (
  telemetry: RunRuntimeTelemetryState,
  event: RunRuntimeTelemetryEvent
): RunRuntimeTelemetryState =>
  telemetry.startedAtMs === null
    ? telemetry
    : {
      ...telemetry,
      events: [...telemetry.events, event]
    }

const runCompletionFromOwnership = (ownership: RunOwnership): RunCompletion => ({
  server: ownership.serverStream
    ? {
      state: "pending",
      summary: null,
      meta: null
    }
    : inactiveRunCompletion.server,
  local: ownership.localDriver
    ? {
      state: "pending"
    }
    : inactiveRunCompletion.local
})

const idleRunSession: RunSession = {
  token: null,
  sequence: null,
  control: "idle",
  outcome: "none",
  ownership: emptyRunOwnership,
  completion: inactiveRunCompletion,
  telemetry: emptyRunRuntimeTelemetryState,
  localRunPlan: null,
  localRunFrame: null,
  program: null
}

const idleRunState = (): RunState => ({
  _tag: "RunIdle",
  session: idleRunSession
})

const makeRunSession = <Control extends RunControlState, Outcome extends RunOutcome>({
  control,
  outcome,
  ownership,
  completion,
  telemetry,
  localRunPlan,
  localRunFrame,
  program,
  sequence,
  token
}: {
  readonly control: Control
  readonly outcome: Outcome
  readonly ownership: RunOwnership
  readonly completion: RunCompletion
  readonly telemetry: RunRuntimeTelemetryState
  readonly localRunPlan: LocalRunPlan | null
  readonly localRunFrame: LocalRunFrame | null
  readonly program: Program
  readonly sequence: number
  readonly token: number
}): ActiveRunSession & { readonly control: Control; readonly outcome: Outcome } => ({
  token,
  sequence,
  control,
  outcome,
  ownership,
  completion,
  telemetry,
  localRunPlan,
  localRunFrame,
  program
})

const runInFlightState = (
  tag: RunInFlightState["_tag"],
  token: number,
  sequence: number,
  ownership: RunOwnership,
  program: Program,
  completion: RunCompletion = runCompletionFromOwnership(ownership),
  telemetry: RunRuntimeTelemetryState = emptyRunRuntimeTelemetryState,
  localRunPlan: LocalRunPlan | null = null,
  localRunFrame: LocalRunFrame | null = null
): RunInFlightState =>
  Match.value(tag).pipe(
    Match.withReturnType<RunInFlightState>(),
    Match.when("RunRunning", () => ({
      _tag: "RunRunning",
      session: makeRunSession({
        token,
        sequence,
        control: "running",
        outcome: "none",
        ownership,
        completion,
        telemetry,
        localRunPlan,
        localRunFrame,
        program
      }),
      sequence,
      program
    })),
    Match.when("RunPaused", () => ({
      _tag: "RunPaused",
      session: makeRunSession({
        token,
        sequence,
        control: "paused",
        outcome: "none",
        ownership,
        completion,
        telemetry,
        localRunPlan,
        localRunFrame,
        program
      }),
      sequence,
      program
    })),
    Match.orElse(() => ({
      _tag: "RunStopping",
      session: makeRunSession({
        token,
        sequence,
        control: "stopping",
        outcome: "none",
        ownership,
        completion,
        telemetry,
        localRunPlan,
        localRunFrame,
        program
      }),
      sequence,
      program
    }))
  )

const isRunInFlightState = (state: RunState): state is RunInFlightState =>
  state.session.outcome === "none" && state.session.control !== "idle"

const hasMatchingSequence = (state: RunState, sequence: number): state is RunInFlightState =>
  isRunInFlightState(state) && state.session.sequence === sequence

export const runReadyForFinalization = (run: RunState): boolean =>
  isRunInFlightState(run) && runCompletionReady(run.session.completion)

const updateRunInFlightCompletion = (state: RunInFlightState, completion: RunCompletion): RunInFlightState =>
  runInFlightState(
    state._tag,
    state.session.token,
    state.sequence,
    state.session.ownership,
    state.program,
    completion,
    state.session.telemetry,
    state.session.localRunPlan,
    state.session.localRunFrame
  )

const updateRunInFlightTelemetry = (
  state: RunInFlightState,
  event: RunRuntimeTelemetryEvent
): RunInFlightState =>
  runInFlightState(
    state._tag,
    state.session.token,
    state.sequence,
    state.session.ownership,
    state.program,
    state.session.completion,
    appendRunRuntimeTelemetryEvent(state.session.telemetry, event),
    state.session.localRunPlan,
    state.session.localRunFrame
  )

const updateRunInFlightFrame = (
  state: RunInFlightState,
  localRunFrame: LocalRunFrame
): RunInFlightState =>
  runInFlightState(
    state._tag,
    state.session.token,
    state.sequence,
    state.session.ownership,
    state.program,
    state.session.completion,
    state.session.telemetry,
    state.session.localRunPlan,
    localRunFrame
  )

const completeServerRunCompletion = (
  completion: RunCompletion,
  summary: string,
  meta: Metadata | null
): RunCompletion => ({
  ...completion,
  server: {
    state: completion.server.state === "inactive" ? "inactive" : "completed",
    summary,
    meta
  }
})

const completeLocalRunCompletion = (completion: RunCompletion): RunCompletion => ({
  ...completion,
  local: {
    state: completion.local.state === "inactive" ? "inactive" : "completed"
  }
})

const terminalRunSession = <Outcome extends Exclude<RunOutcome, "none">>(
  state: RunInFlightState,
  outcome: Outcome
): TerminalRunSession & { readonly outcome: Outcome } =>
  makeRunSession({
    token: state.session.token,
    sequence: state.session.sequence,
    control: "idle",
    outcome,
    ownership: state.session.ownership,
    completion: state.session.completion,
    telemetry: state.session.telemetry,
    localRunPlan: state.session.localRunPlan,
    localRunFrame: state.session.localRunFrame,
    program: state.program
  })

const failedRunState = (state: RunInFlightState, error: DemoError): RunState => ({
  _tag: "RunFailed",
  session: terminalRunSession(state, "failed"),
  sequence: state.sequence,
  program: state.program,
  error
})

const stoppedRunState = (state: RunInFlightState): RunState => ({
  _tag: "RunStopped",
  session: terminalRunSession(state, "stopped"),
  sequence: state.sequence,
  program: state.program
})

const succeededRunState = (state: RunInFlightState, data: RunData, meta: Metadata | null): RunState => ({
  _tag: "RunSuccess",
  session: terminalRunSession(state, "succeeded"),
  sequence: state.sequence,
  data,
  meta
})

export type RunMessage =
  | {
    readonly _tag: "RunStarted"
    readonly token: number
    readonly sequence: number
    readonly ownership: RunOwnership
    readonly startedAtMs: number
    readonly localRunPlan: LocalRunPlan | null
    readonly program: Program
  }
  | {
    readonly _tag: "RunFrameUpdated"
    readonly sequence: number
    readonly frame: LocalRunFrame
  }
  | {
    readonly _tag: "RunServerCompleted"
    readonly sequence: number
    readonly observedAtMs: number
    readonly summary: string
    readonly meta: Metadata | null
  }
  | { readonly _tag: "RunLocalCompleted"; readonly sequence: number; readonly observedAtMs: number }
  | { readonly _tag: "RunPauseCheckpointReached"; readonly sequence: number; readonly observedAtMs: number }
  | { readonly _tag: "RunPaused"; readonly sequence: number; readonly requestedAtMs: number }
  | { readonly _tag: "RunResumed"; readonly sequence: number }
  | { readonly _tag: "RunStopping"; readonly sequence: number }
  | { readonly _tag: "RunStopped"; readonly sequence: number; readonly finalizedAtMs: number }
  | { readonly _tag: "RunFailed"; readonly sequence: number; readonly finalizedAtMs: number; readonly error: DemoError }
  | {
    readonly _tag: "RunSucceeded"
    readonly sequence: number
    readonly finalizedAtMs: number
    readonly data: RunData
    readonly meta: Metadata | null
  }
  | { readonly _tag: "RunReset" }

export const reduceRunState = (state: RunState, message: RunMessage): RunState =>
  Match.value(message).pipe(
    Match.tag("RunStarted", ({ token, sequence, ownership, startedAtMs, localRunPlan, program }): RunState =>
      runInFlightState(
        "RunRunning",
        token,
        sequence,
        ownership,
        program,
        runCompletionFromOwnership(ownership),
        startedRunRuntimeTelemetryState(startedAtMs),
        localRunPlan,
        null
      )),
    Match.tag("RunFrameUpdated", ({ sequence, frame }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightFrame(state, frame)
        : state),
    Match.tag("RunServerCompleted", ({ sequence, observedAtMs, summary, meta }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightTelemetry(
          updateRunInFlightCompletion(state, completeServerRunCompletion(state.session.completion, summary, meta)),
          { kind: "server-completed", atMs: observedAtMs, detail: null }
        )
        : state),
    Match.tag("RunLocalCompleted", ({ sequence, observedAtMs }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightTelemetry(
          updateRunInFlightCompletion(state, completeLocalRunCompletion(state.session.completion)),
          { kind: "local-completed", atMs: observedAtMs, detail: null }
        )
        : state),
    Match.tag("RunPauseCheckpointReached", ({ sequence, observedAtMs }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightTelemetry(state, { kind: "checkpoint-reached", atMs: observedAtMs, detail: null })
        : state),
    Match.tag("RunPaused", ({ sequence, requestedAtMs }): RunState =>
      state._tag === "RunRunning" && state.sequence === sequence
        ? updateRunInFlightTelemetry(
          runInFlightState(
            "RunPaused",
            state.session.token,
            sequence,
            state.session.ownership,
            state.program,
            state.session.completion,
            state.session.telemetry,
            state.session.localRunPlan,
            state.session.localRunFrame
          ),
          { kind: "pause-requested", atMs: requestedAtMs, detail: null }
        )
        : state),
    Match.tag("RunResumed", ({ sequence }): RunState =>
      state._tag === "RunPaused" && state.sequence === sequence
        ? runInFlightState(
          "RunRunning",
          state.session.token,
          sequence,
          state.session.ownership,
          state.program,
          state.session.completion,
          state.session.telemetry,
          state.session.localRunPlan,
          state.session.localRunFrame
        )
        : state),
    Match.tag("RunStopping", ({ sequence }): RunState =>
      hasMatchingSequence(state, sequence)
        ? runInFlightState(
          "RunStopping",
          state.session.token,
          sequence,
          state.session.ownership,
          state.program,
          state.session.completion,
          state.session.telemetry,
          state.session.localRunPlan,
          state.session.localRunFrame
        )
        : state),
    Match.tag("RunStopped", ({ sequence, finalizedAtMs }): RunState =>
      hasMatchingSequence(state, sequence)
        ? stoppedRunState(
          updateRunInFlightTelemetry(state, {
            kind: "run-finalized",
            atMs: finalizedAtMs,
            detail: "stopped"
          })
        )
        : state),
    Match.tag("RunFailed", ({ sequence, finalizedAtMs, error }): RunState =>
      hasMatchingSequence(state, sequence)
        ? failedRunState(
          updateRunInFlightTelemetry(state, {
            kind: "run-finalized",
            atMs: finalizedAtMs,
            detail: "failed"
          }),
          error
        )
        : state),
    Match.tag("RunSucceeded", ({ sequence, finalizedAtMs, data, meta }): RunState =>
      hasMatchingSequence(state, sequence)
        ? succeededRunState(
          updateRunInFlightTelemetry(state, {
            kind: "run-finalized",
            atMs: finalizedAtMs,
            detail: "succeeded"
          }),
          data,
          meta
        )
        : state),
    Match.tag("RunReset", (): RunState =>
      idleRunState()),
    Match.exhaustive
  )

export const initialSurfaceState = (id: Id): SurfaceState => ({
  id,
  stageTab: "interactive",
  preload: { _tag: "PreloadIdle" },
  run: idleRunState(),
  nextSequence: 1,
  programSourceScope: "run",
  programFileIndex: 0
})
