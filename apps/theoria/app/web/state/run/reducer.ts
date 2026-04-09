import { Match } from "effect"

import { RunInternalFacts } from "./internal-facts.js"
import type { RunMessage } from "./messages.js"
import { RunRuntimeTelemetryState } from "./runtime-telemetry-state.js"
import { RunIdleState, RunInFlightState } from "./state.js"
import type { RunState as RunStateValue } from "./types.js"

export const reduceRunState = (state: RunStateValue, message: RunMessage): RunStateValue =>
  Match.value(message).pipe(
    Match.tag(
      "RunStarted",
      ({ token, sequence, ownership, startedAtMs, draft, identity, localProjectionScript, program }): RunStateValue =>
        RunInFlightState.start({
          token,
          sequence,
          control: "running",
          ownership,
          program,
          facts: RunInternalFacts.fromOwnership(ownership),
          telemetry: RunRuntimeTelemetryState.started({ ownership, startedAtMs }),
          draft,
          identity,
          localProjectionScript,
          localRunFrame: null
        })
    ),
    Match.tag("RunFrameUpdated", ({ sequence, frame }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.withLocalRunFrame(frame)
        : state),
    Match.tag("RunCanonicalFrameObserved", ({ sequence, frame }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.withCanonicalFrame(frame)
        : state),
    Match.tag("RunChoreographyObserved", ({ sequence, state: choreography }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.withChoreography(choreography)
        : state),
    Match.tag("RunStreamCompleteObserved", ({ sequence, observedAtMs, summary, meta }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.observeStreamCompletion({ observedAtMs, summary, meta })
        : state),
    Match.tag("RunStepQueueDrained", ({ sequence, observedAtMs }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.observeStepQueueDrain(observedAtMs)
        : state),
    Match.tag("RunPauseCheckpointReached", ({ sequence, observedAtMs }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.observeTelemetry({ kind: "checkpoint-reached", atMs: observedAtMs, detail: null })
        : state),
    Match.tag("RunPaused", ({ sequence, requestedAtMs }): RunStateValue =>
      state._tag === "RunRunning" && state.sequence === sequence && state.session.control === "running"
        ? state.paused(requestedAtMs)
        : state),
    Match.tag("RunResumed", ({ sequence, requestedAtMs }): RunStateValue =>
      state._tag === "RunRunning" && state.sequence === sequence && state.session.control === "paused"
        ? state.resumed(requestedAtMs)
        : state),
    Match.tag("RunStopping", ({ sequence, requestedAtMs }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.stopping(requestedAtMs)
        : state),
    Match.tag("RunStopped", ({ sequence, stoppedAtMs }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.stopped(stoppedAtMs)
        : state),
    Match.tag("RunFailed", ({ sequence, finalizedAtMs, error }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.failed({ error, finalizedAtMs })
        : state),
    Match.tag("RunSucceeded", ({ sequence, finalizedAtMs, data, meta }): RunStateValue =>
      RunInFlightState.hasSequence(state, sequence)
        ? state.session.facts.successGateSatisfied()
          ? state.succeeded({ data, meta, finalizedAtMs })
          : state
        : state),
    Match.tag("RunReset", (): RunStateValue =>
      RunIdleState.make()),
    Match.exhaustive
  )
