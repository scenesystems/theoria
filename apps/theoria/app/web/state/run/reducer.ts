import { Match } from "effect"

import type { RunMessage } from "./messages.js"
import {
  hasMatchingSequence,
  initialRunState,
  runFactsFromOwnership,
  runInFlightState,
  startedRunRuntimeTelemetryState
} from "./session.js"
import {
  failedRunState,
  observeStepQueueDrainFact,
  observeStreamCompletionFact,
  stoppedRunState,
  succeededRunState,
  updateRunInFlightCanonicalFrame,
  updateRunInFlightChoreography,
  updateRunInFlightFacts,
  updateRunInFlightFrame,
  updateRunInFlightTelemetry
} from "./transitions.js"
import { type RunState, runSuccessGateSatisfied } from "./types.js"

export const reduceRunState = (state: RunState, message: RunMessage): RunState =>
  Match.value(message).pipe(
    Match.tag(
      "RunStarted",
      ({ token, sequence, ownership, startedAtMs, draft, identity, localProjectionScript, program }): RunState =>
        runInFlightState(
          token,
          sequence,
          "running",
          ownership,
          program,
          runFactsFromOwnership(ownership),
          startedRunRuntimeTelemetryState({ ownership, startedAtMs }),
          draft,
          identity,
          localProjectionScript,
          null
        )
    ),
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
            state.session.draft,
            state.session.identity,
            state.session.localProjectionScript,
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
            state.session.draft,
            state.session.identity,
            state.session.localProjectionScript,
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
            state.session.draft,
            state.session.identity,
            state.session.localProjectionScript,
            state.session.localRunFrame,
            state.session.canonicalFrame,
            state.session.choreography
          ),
          { kind: "stop-requested", atMs: requestedAtMs, detail: null }
        )
        : state),
    Match.tag("RunStopped", ({ sequence, stoppedAtMs }): RunState =>
      hasMatchingSequence(state, sequence)
        ? stoppedRunState(state, stoppedAtMs)
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
      initialRunState()),
    Match.exhaustive
  )
