import type { DemoError } from "../../../contracts/demo-error.js"
import type { Metadata } from "../../../contracts/envelope.js"
import type { RunData } from "../../../contracts/study/run.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { ChoreographyState } from "../../../contracts/study/workflow/choreography.js"

import type { LocalRunFrame } from "./local.js"
import { appendRunRuntimeTelemetryEvent, makeRunSession, runInFlightState, terminalRunSession } from "./session.js"
import type { RunInFlightState, RunInternalFacts, RunRuntimeTelemetryEvent, RunState } from "./types.js"

export const updateRunInFlightFacts = (
  state: RunInFlightState,
  facts: RunInternalFacts
): RunInFlightState =>
  runInFlightState(
    state.session.token,
    state.sequence,
    state.session.control,
    state.session.ownership,
    state.program,
    facts,
    state.session.telemetry,
    state.session.draft,
    state.session.identity,
    state.session.localProjectionScript,
    state.session.localRunFrame,
    state.session.canonicalFrame,
    state.session.choreography
  )

export const updateRunInFlightTelemetry = (
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
    state.session.draft,
    state.session.identity,
    state.session.localProjectionScript,
    state.session.localRunFrame,
    state.session.canonicalFrame,
    state.session.choreography
  )

export const updateRunInFlightFrame = (
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
    state.session.draft,
    state.session.identity,
    state.session.localProjectionScript,
    localRunFrame,
    state.session.canonicalFrame,
    state.session.choreography
  )

export const updateRunInFlightCanonicalFrame = (
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
    state.session.draft,
    state.session.identity,
    state.session.localProjectionScript,
    state.session.localRunFrame,
    canonicalFrame,
    state.session.choreography
  )

export const updateRunInFlightChoreography = (
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
    state.session.draft,
    state.session.identity,
    state.session.localProjectionScript,
    state.session.localRunFrame,
    state.session.canonicalFrame,
    choreography
  )

export const observeStreamCompletionFact = (
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

export const observeStepQueueDrainFact = (
  facts: RunInternalFacts,
  observedAtMs: number
): RunInternalFacts => ({
  ...facts,
  stepQueueDrain: {
    state: facts.stepQueueDrain.state === "inactive" ? "inactive" : "observed",
    observedAtMs: facts.stepQueueDrain.state === "inactive" ? null : observedAtMs
  }
})

export const failedRunState = (
  state: RunInFlightState,
  error: DemoError
): RunState => ({
  _tag: "RunFailed",
  session: terminalRunSession(state, "failed"),
  sequence: state.sequence,
  program: state.program,
  error
})

export const stoppedRunState = (
  state: RunInFlightState,
  stoppedAtMs: number
): RunState => ({
  _tag: "RunIdle",
  session: makeRunSession({
    token: state.session.token,
    sequence: state.session.sequence,
    control: "idle",
    outcome: "none",
    ownership: state.session.ownership,
    facts: state.session.facts,
    telemetry: appendRunRuntimeTelemetryEvent(state.session.telemetry, {
      kind: "run-finalized",
      atMs: stoppedAtMs,
      detail: "stopped"
    }),
    draft: state.session.draft,
    identity: state.session.identity,
    localProjectionScript: state.session.localProjectionScript,
    localRunFrame: state.session.localRunFrame,
    canonicalFrame: state.session.canonicalFrame,
    choreography: state.session.choreography,
    program: state.program
  })
})

export const succeededRunState = (
  state: RunInFlightState,
  data: RunData,
  meta: Metadata | null
): RunState => ({
  _tag: "RunSuccess",
  session: terminalRunSession(state, "succeeded"),
  sequence: state.sequence,
  data,
  meta
})
