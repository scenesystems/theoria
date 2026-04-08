import type { EntryDraft } from "../../../contracts/entry/registry.js"
import type { Program } from "../../../contracts/presentation/program.js"
import type { EntryRunIdentity } from "../../../contracts/study/run-plan.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import { type ChoreographyState, initialChoreographyState } from "../../../contracts/study/workflow/choreography.js"

import type { LocalProjectionScript, LocalRunFrame } from "./local.js"
import type {
  RunControlState,
  RunInFlightState,
  RunInternalFacts,
  RunOutcome,
  RunOwnership,
  RunRuntimeTelemetryEvent,
  RunRuntimeTelemetryState,
  RunSession,
  RunState
} from "./types.js"

export type ActiveRunSession = RunSession & {
  readonly token: number
  readonly sequence: number
  readonly program: Program
}

export type InFlightRunControlState = Exclude<RunControlState, "idle">

export type InFlightRunSession = ActiveRunSession & {
  readonly outcome: "none"
  readonly control: InFlightRunControlState
}

export type TerminalRunSession = ActiveRunSession & {
  readonly control: "idle"
  readonly outcome: Exclude<RunOutcome, "none">
}

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

export const startedRunRuntimeTelemetryState = ({
  ownership,
  startedAtMs
}: {
  readonly ownership: RunOwnership
  readonly startedAtMs: number
}): RunRuntimeTelemetryState => ({
  startedAtMs,
  events: [{ kind: "run-started", atMs: startedAtMs, detail: ownershipDetail(ownership) }]
})

export const appendRunRuntimeTelemetryEvent = (
  telemetry: RunRuntimeTelemetryState,
  event: RunRuntimeTelemetryEvent
): RunRuntimeTelemetryState =>
  telemetry.startedAtMs === null
    ? telemetry
    : {
      ...telemetry,
      events: [...telemetry.events, event]
    }

export const runFactsFromOwnership = (ownership: RunOwnership): RunInternalFacts => ({
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
  draft: null,
  identity: null,
  localProjectionScript: null,
  localRunFrame: null,
  canonicalFrame: null,
  choreography: initialChoreographyState,
  program: null
}

export const initialRunState = (): RunState => ({
  _tag: "RunIdle",
  session: idleRunSession
})

export const makeRunSession = <Control extends RunControlState, Outcome extends RunOutcome>({
  control,
  outcome,
  ownership,
  facts,
  telemetry,
  draft,
  identity,
  localProjectionScript,
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
  readonly draft: EntryDraft | null
  readonly identity: EntryRunIdentity | null
  readonly localProjectionScript: LocalProjectionScript | null
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
  draft,
  identity,
  localProjectionScript,
  localRunFrame,
  canonicalFrame,
  choreography,
  program
})

export const runInFlightState = (
  token: number,
  sequence: number,
  control: InFlightRunControlState,
  ownership: RunOwnership,
  program: Program,
  facts: RunInternalFacts = runFactsFromOwnership(ownership),
  telemetry: RunRuntimeTelemetryState = emptyRunRuntimeTelemetryState,
  draft: EntryDraft | null = null,
  identity: EntryRunIdentity | null = null,
  localProjectionScript: LocalProjectionScript | null = null,
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
    draft,
    identity,
    localProjectionScript,
    localRunFrame,
    canonicalFrame,
    choreography,
    program
  }),
  sequence,
  program
})

export const isRunInFlightState = (state: RunState): state is RunInFlightState => state._tag === "RunRunning"

export const hasMatchingSequence = (
  state: RunState,
  sequence: number
): state is RunInFlightState => isRunInFlightState(state) && state.session.sequence === sequence

export const terminalRunSession = <Outcome extends Exclude<RunOutcome, "none">>(
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
    draft: state.session.draft,
    identity: state.session.identity,
    localProjectionScript: state.session.localProjectionScript,
    localRunFrame: state.session.localRunFrame,
    canonicalFrame: state.session.canonicalFrame,
    choreography: state.session.choreography,
    program: state.program
  })
