import { Match } from "effect"

import type { CanonicalFrame } from "../../contracts/canonical-step.js"
import { type ChoreographyCue, type ChoreographyState, initialChoreographyState } from "../../contracts/choreography.js"
import type { DemoError } from "../../contracts/demo-error.js"
import type { Metadata } from "../../contracts/envelope.js"
import {
  appendEvidenceSectionToStore,
  applyEvidenceEventToStore,
  emptyEvidenceStoreState,
  evidenceSectionsFromStore,
  type EvidenceStoreState
} from "../../contracts/evidence-store.js"
import type { EvidenceEvent } from "../../contracts/evidence-stream.js"
import type { EvidenceSection } from "../../contracts/evidence.js"
import type { SurfaceId } from "../../contracts/id.js"
import type { Program, ProgramSourceScope } from "../../contracts/presentation.js"
import type { ProgramPreview } from "../../contracts/program-preview.js"
import type { SurfaceRunPlan } from "../../contracts/run-plan.js"
import type { RunData } from "../../contracts/run.js"
import type { LocalRunFrame, LocalRunPlan } from "./local-run.js"

export {
  appendEvidenceSectionToStore,
  applyEvidenceEventToStore,
  emptyEvidenceStoreState,
  evidenceSectionsFromStore
} from "../../contracts/evidence-store.js"
export type { EvidenceStoreState } from "../../contracts/evidence-store.js"
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

export type EvidenceStatusState = {
  readonly complete: boolean
  readonly sectionCount: number
}

export type RunControlState = "idle" | "running" | "paused" | "stopping"
export type RunOutcome = "none" | "failed" | "succeeded"

export type RunOwnership = {
  readonly localDriver: boolean
  readonly serverStream: boolean
}

export type RunInternalFactState = "inactive" | "pending" | "observed"

export type RunStreamCompletionFact = {
  readonly state: RunInternalFactState
  readonly observedAtMs: number | null
  readonly summary: string | null
  readonly meta: Metadata | null
}

export type RunStepQueueDrainFact = {
  readonly state: RunInternalFactState
  readonly observedAtMs: number | null
}

export type RunInternalFacts = {
  readonly streamComplete: RunStreamCompletionFact
  readonly stepQueueDrain: RunStepQueueDrainFact
}

export type RunRuntimeTelemetryKind =
  | "run-started"
  | "pause-requested"
  | "resume-requested"
  | "stop-requested"
  | "checkpoint-reached"
  | "stream-complete-observed"
  | "step-queue-drained"
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
  readonly facts: RunInternalFacts
  readonly telemetry: RunRuntimeTelemetryState
  readonly runPlan: SurfaceRunPlan | null
  readonly localRunPlan: LocalRunPlan | null
  readonly localRunFrame: LocalRunFrame | null
  readonly canonicalFrame: CanonicalFrame | null
  readonly choreography: ChoreographyState
  readonly program: Program | null
}

type ActiveRunSession = RunSession & {
  readonly token: number
  readonly sequence: number
  readonly program: Program
}

type InFlightRunControlState = Exclude<RunControlState, "idle">

type InFlightRunSession = ActiveRunSession & {
  readonly outcome: "none"
  readonly control: InFlightRunControlState
}

type TerminalRunSession = ActiveRunSession & {
  readonly control: "idle"
  readonly outcome: Exclude<RunOutcome, "none">
}

export type RunInFlightState = {
  readonly _tag: "RunRunning"
  readonly session: InFlightRunSession
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
    readonly _tag: "RunSuccess"
    readonly session: TerminalRunSession & { readonly outcome: "succeeded" }
    readonly sequence: number
    readonly data: RunData
    readonly meta: Metadata | null
  }

export type RunPhase = "idle" | "running" | "paused" | "stopping" | "failed" | "success"

export type SurfaceState = {
  readonly id: SurfaceId
  readonly stageTab: StageTab
  readonly preload: PreloadState
  readonly run: RunState
  readonly nextSequence: number
  readonly programSourceScope: ProgramSourceScope
  readonly programFileIndex: number
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

const upsertSection = (
  sections: ReadonlyArray<EvidenceSection>,
  section: EvidenceSection
): ReadonlyArray<EvidenceSection> => {
  const index = sections.findIndex((current) => current.title === section.title)

  return index === -1
    ? [...sections, section]
    : sections.map((current, currentIndex) => (currentIndex === index ? section : current))
}

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
  const stateWithSections = data.sections.reduce(appendEvidenceSectionToStore, emptyEvidenceStoreState)

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

const isRunInternalFactPending = (state: RunInternalFactState): boolean => state === "pending"

const isRunInternalFactObserved = (state: RunInternalFactState): boolean => state === "observed"

const runFactsReady = (facts: RunInternalFacts): boolean =>
  !isRunInternalFactPending(facts.streamComplete.state) && !isRunInternalFactPending(facts.stepQueueDrain.state)

export const runHasStreamCompletion = (run: RunState): boolean =>
  isRunInternalFactObserved(run.session.facts.streamComplete.state)

export const runHasStepQueueDrain = (run: RunState): boolean =>
  isRunInternalFactObserved(run.session.facts.stepQueueDrain.state)

export const runAwaitsStreamCompletion = (run: RunState): boolean =>
  isRunInternalFactPending(run.session.facts.streamComplete.state)

export const runAwaitsStepQueueDrain = (run: RunState): boolean =>
  isRunInternalFactPending(run.session.facts.stepQueueDrain.state)

export const runStreamCompletionSummary = (run: RunState): string | null => run.session.facts.streamComplete.summary

export const runPhase = (run: RunState): RunPhase =>
  Match.value(run.session.outcome).pipe(
    Match.withReturnType<RunPhase>(),
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
    Match.tag("RunFailed", ({ program }) => program),
    Match.tag("RunSuccess", ({ data }) => data.program),
    Match.orElse(() => null)
  )

const emptyRunOwnership: RunOwnership = {
  localDriver: false,
  serverStream: false
}

const inactiveRunFacts: RunInternalFacts = {
  streamComplete: {
    state: "inactive",
    observedAtMs: null,
    summary: null,
    meta: null
  },
  stepQueueDrain: {
    state: "inactive",
    observedAtMs: null
  }
}

const emptyRunRuntimeTelemetryState: RunRuntimeTelemetryState = {
  startedAtMs: null,
  events: []
}

const ownershipDetail = (ownership: RunOwnership): string =>
  `local=${ownership.localDriver ? "yes" : "no"} · server=${ownership.serverStream ? "yes" : "no"}`

const startedRunRuntimeTelemetryState = ({
  ownership,
  startedAtMs
}: {
  readonly ownership: RunOwnership
  readonly startedAtMs: number
}): RunRuntimeTelemetryState => ({
  startedAtMs,
  events: [{ kind: "run-started", atMs: startedAtMs, detail: ownershipDetail(ownership) }]
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

const runFactsFromOwnership = (ownership: RunOwnership): RunInternalFacts => ({
  streamComplete: ownership.serverStream
    ? {
      state: "pending",
      observedAtMs: null,
      summary: null,
      meta: null
    }
    : inactiveRunFacts.streamComplete,
  stepQueueDrain: ownership.localDriver
    ? {
      state: "pending",
      observedAtMs: null
    }
    : inactiveRunFacts.stepQueueDrain
})

const idleRunSession: RunSession = {
  token: null,
  sequence: null,
  control: "idle",
  outcome: "none",
  ownership: emptyRunOwnership,
  facts: inactiveRunFacts,
  telemetry: emptyRunRuntimeTelemetryState,
  runPlan: null,
  localRunPlan: null,
  localRunFrame: null,
  canonicalFrame: null,
  choreography: initialChoreographyState,
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
  facts,
  telemetry,
  runPlan,
  localRunPlan,
  localRunFrame,
  canonicalFrame,
  choreography,
  program,
  sequence,
  token
}: {
  readonly control: Control
  readonly outcome: Outcome
  readonly ownership: RunOwnership
  readonly facts: RunInternalFacts
  readonly telemetry: RunRuntimeTelemetryState
  readonly runPlan: SurfaceRunPlan | null
  readonly localRunPlan: LocalRunPlan | null
  readonly localRunFrame: LocalRunFrame | null
  readonly canonicalFrame: CanonicalFrame | null
  readonly choreography: ChoreographyState
  readonly program: Program
  readonly sequence: number
  readonly token: number
}): ActiveRunSession & { readonly control: Control; readonly outcome: Outcome } => ({
  token,
  sequence,
  control,
  outcome,
  ownership,
  facts,
  telemetry,
  runPlan,
  localRunPlan,
  localRunFrame,
  canonicalFrame,
  choreography,
  program
})

const runInFlightState = (
  token: number,
  sequence: number,
  control: InFlightRunControlState,
  ownership: RunOwnership,
  program: Program,
  facts: RunInternalFacts = runFactsFromOwnership(ownership),
  telemetry: RunRuntimeTelemetryState = emptyRunRuntimeTelemetryState,
  runPlan: SurfaceRunPlan | null = null,
  localRunPlan: LocalRunPlan | null = null,
  localRunFrame: LocalRunFrame | null = null,
  canonicalFrame: CanonicalFrame | null = null,
  choreography: ChoreographyState = initialChoreographyState
): RunInFlightState => ({
  _tag: "RunRunning",
  session: makeRunSession({
    token,
    sequence,
    control,
    outcome: "none",
    ownership,
    facts,
    telemetry,
    runPlan,
    localRunPlan,
    localRunFrame,
    canonicalFrame,
    choreography,
    program
  }),
  sequence,
  program
})

const isRunInFlightState = (state: RunState): state is RunInFlightState => state._tag === "RunRunning"

const hasMatchingSequence = (state: RunState, sequence: number): state is RunInFlightState =>
  isRunInFlightState(state) && state.session.sequence === sequence

export const runSuccessGateSatisfied = (run: RunState): boolean =>
  isRunInFlightState(run) && runFactsReady(run.session.facts)

const updateRunInFlightFacts = (state: RunInFlightState, facts: RunInternalFacts): RunInFlightState =>
  runInFlightState(
    state.session.token,
    state.sequence,
    state.session.control,
    state.session.ownership,
    state.program,
    facts,
    state.session.telemetry,
    state.session.runPlan,
    state.session.localRunPlan,
    state.session.localRunFrame,
    state.session.canonicalFrame,
    state.session.choreography
  )

const updateRunInFlightTelemetry = (
  state: RunInFlightState,
  event: RunRuntimeTelemetryEvent
): RunInFlightState =>
  runInFlightState(
    state.session.token,
    state.sequence,
    state.session.control,
    state.session.ownership,
    state.program,
    state.session.facts,
    appendRunRuntimeTelemetryEvent(state.session.telemetry, event),
    state.session.runPlan,
    state.session.localRunPlan,
    state.session.localRunFrame,
    state.session.canonicalFrame,
    state.session.choreography
  )

const updateRunInFlightFrame = (
  state: RunInFlightState,
  localRunFrame: LocalRunFrame
): RunInFlightState =>
  runInFlightState(
    state.session.token,
    state.sequence,
    state.session.control,
    state.session.ownership,
    state.program,
    state.session.facts,
    state.session.telemetry,
    state.session.runPlan,
    state.session.localRunPlan,
    localRunFrame,
    state.session.canonicalFrame,
    state.session.choreography
  )

const updateRunInFlightCanonicalFrame = (
  state: RunInFlightState,
  canonicalFrame: CanonicalFrame
): RunInFlightState =>
  runInFlightState(
    state.session.token,
    state.sequence,
    state.session.control,
    state.session.ownership,
    state.program,
    state.session.facts,
    state.session.telemetry,
    state.session.runPlan,
    state.session.localRunPlan,
    state.session.localRunFrame,
    canonicalFrame,
    state.session.choreography
  )

const updateRunInFlightChoreography = (
  state: RunInFlightState,
  choreography: ChoreographyState
): RunInFlightState =>
  runInFlightState(
    state.session.token,
    state.sequence,
    state.session.control,
    state.session.ownership,
    state.program,
    state.session.facts,
    state.session.telemetry,
    state.session.runPlan,
    state.session.localRunPlan,
    state.session.localRunFrame,
    state.session.canonicalFrame,
    choreography
  )

const observeStreamCompletionFact = (
  facts: RunInternalFacts,
  observedAtMs: number,
  summary: string,
  meta: Metadata | null
): RunInternalFacts => ({
  ...facts,
  streamComplete: {
    state: facts.streamComplete.state === "inactive" ? "inactive" : "observed",
    observedAtMs: facts.streamComplete.state === "inactive" ? null : observedAtMs,
    summary,
    meta
  }
})

const observeStepQueueDrainFact = (
  facts: RunInternalFacts,
  observedAtMs: number
): RunInternalFacts => ({
  ...facts,
  stepQueueDrain: {
    state: facts.stepQueueDrain.state === "inactive" ? "inactive" : "observed",
    observedAtMs: facts.stepQueueDrain.state === "inactive" ? null : observedAtMs
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
    facts: state.session.facts,
    telemetry: state.session.telemetry,
    runPlan: state.session.runPlan,
    localRunPlan: state.session.localRunPlan,
    localRunFrame: state.session.localRunFrame,
    canonicalFrame: state.session.canonicalFrame,
    choreography: state.session.choreography,
    program: state.program
  })

const failedRunState = (state: RunInFlightState, error: DemoError): RunState => ({
  _tag: "RunFailed",
  session: terminalRunSession(state, "failed"),
  sequence: state.sequence,
  program: state.program,
  error
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
    readonly runPlan: SurfaceRunPlan
    readonly localRunPlan: LocalRunPlan | null
    readonly program: Program
  }
  | {
    readonly _tag: "RunFrameUpdated"
    readonly sequence: number
    readonly frame: LocalRunFrame
  }
  | {
    readonly _tag: "RunCanonicalFrameObserved"
    readonly sequence: number
    readonly frame: CanonicalFrame
  }
  | {
    readonly _tag: "RunChoreographyObserved"
    readonly sequence: number
    readonly cue: ChoreographyCue
    readonly state: ChoreographyState
  }
  | {
    readonly _tag: "RunStreamCompleteObserved"
    readonly sequence: number
    readonly observedAtMs: number
    readonly summary: string
    readonly meta: Metadata | null
  }
  | { readonly _tag: "RunStepQueueDrained"; readonly sequence: number; readonly observedAtMs: number }
  | { readonly _tag: "RunPauseCheckpointReached"; readonly sequence: number; readonly observedAtMs: number }
  | { readonly _tag: "RunPaused"; readonly sequence: number; readonly requestedAtMs: number }
  | { readonly _tag: "RunResumed"; readonly sequence: number; readonly requestedAtMs: number }
  | { readonly _tag: "RunStopping"; readonly sequence: number; readonly requestedAtMs: number }
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
    Match.tag("RunStarted", ({ token, sequence, ownership, startedAtMs, runPlan, localRunPlan, program }): RunState =>
      runInFlightState(
        token,
        sequence,
        "running",
        ownership,
        program,
        runFactsFromOwnership(ownership),
        startedRunRuntimeTelemetryState({ ownership, startedAtMs }),
        runPlan,
        localRunPlan,
        null
      )),
    Match.tag("RunFrameUpdated", ({ sequence, frame }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightFrame(state, frame)
        : state),
    Match.tag("RunCanonicalFrameObserved", ({ sequence, frame }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightCanonicalFrame(state, frame)
        : state),
    Match.tag("RunChoreographyObserved", ({ sequence, state: choreography }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightChoreography(state, choreography)
        : state),
    Match.tag("RunStreamCompleteObserved", ({ sequence, observedAtMs, summary, meta }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightTelemetry(
          updateRunInFlightFacts(state, observeStreamCompletionFact(state.session.facts, observedAtMs, summary, meta)),
          { kind: "stream-complete-observed", atMs: observedAtMs, detail: null }
        )
        : state),
    Match.tag("RunStepQueueDrained", ({ sequence, observedAtMs }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightTelemetry(
          updateRunInFlightFacts(state, observeStepQueueDrainFact(state.session.facts, observedAtMs)),
          { kind: "step-queue-drained", atMs: observedAtMs, detail: null }
        )
        : state),
    Match.tag("RunPauseCheckpointReached", ({ sequence, observedAtMs }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightTelemetry(state, { kind: "checkpoint-reached", atMs: observedAtMs, detail: null })
        : state),
    Match.tag("RunPaused", ({ sequence, requestedAtMs }): RunState =>
      state._tag === "RunRunning" && state.sequence === sequence && state.session.control === "running"
        ? updateRunInFlightTelemetry(
          runInFlightState(
            state.session.token,
            sequence,
            "paused",
            state.session.ownership,
            state.program,
            state.session.facts,
            state.session.telemetry,
            state.session.runPlan,
            state.session.localRunPlan,
            state.session.localRunFrame,
            state.session.canonicalFrame,
            state.session.choreography
          ),
          { kind: "pause-requested", atMs: requestedAtMs, detail: null }
        )
        : state),
    Match.tag("RunResumed", ({ sequence, requestedAtMs }): RunState =>
      state._tag === "RunRunning" && state.sequence === sequence && state.session.control === "paused"
        ? updateRunInFlightTelemetry(
          runInFlightState(
            state.session.token,
            sequence,
            "running",
            state.session.ownership,
            state.program,
            state.session.facts,
            state.session.telemetry,
            state.session.runPlan,
            state.session.localRunPlan,
            state.session.localRunFrame,
            state.session.canonicalFrame,
            state.session.choreography
          ),
          { kind: "resume-requested", atMs: requestedAtMs, detail: null }
        )
        : state),
    Match.tag("RunStopping", ({ sequence, requestedAtMs }): RunState =>
      hasMatchingSequence(state, sequence)
        ? updateRunInFlightTelemetry(
          runInFlightState(
            state.session.token,
            sequence,
            "stopping",
            state.session.ownership,
            state.program,
            state.session.facts,
            state.session.telemetry,
            state.session.runPlan,
            state.session.localRunPlan,
            state.session.localRunFrame,
            state.session.canonicalFrame,
            state.session.choreography
          ),
          { kind: "stop-requested", atMs: requestedAtMs, detail: null }
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
        ? runSuccessGateSatisfied(state)
          ? succeededRunState(
            updateRunInFlightTelemetry(state, {
              kind: "run-finalized",
              atMs: finalizedAtMs,
              detail: "succeeded"
            }),
            data,
            meta
          )
          : state
        : state),
    Match.tag("RunReset", (): RunState =>
      idleRunState()),
    Match.exhaustive
  )

export const initialSurfaceState = (id: SurfaceId): SurfaceState => ({
  id,
  stageTab: "interactive",
  preload: { _tag: "PreloadIdle" },
  run: idleRunState(),
  nextSequence: 1,
  programSourceScope: "run",
  programFileIndex: 0
})
