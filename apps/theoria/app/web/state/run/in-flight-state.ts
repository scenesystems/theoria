import { Data } from "effect"

import type { EntryError } from "../../../contracts/entry-error.js"
import type { EntryDraft } from "../../../contracts/entry/registry.js"
import type { Metadata } from "../../../contracts/envelope.js"
import type { Program } from "../../../contracts/presentation/program.js"
import type { EntryRunIdentity } from "../../../contracts/study/run-plan.js"
import type { RunData } from "../../../contracts/study/run.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import { type ChoreographyState, initialChoreographyState } from "../../../contracts/study/workflow/choreography.js"

import { RunIdleState } from "./idle-state.js"
import { RunInternalFacts } from "./internal-facts.js"
import type { LocalProjectionScript, LocalRunFrame } from "./local.js"
import { RunRuntimeTelemetryState } from "./runtime-telemetry-state.js"
import type { InFlightRunControlState, InFlightRunSession } from "./session.js"
import { RunSession } from "./session.js"
import { RunFailedState, RunSuccessState } from "./terminal-state.js"
import type { RunOwnership, RunRuntimeTelemetryEvent } from "./types.js"

export class RunInFlightState extends Data.TaggedClass("RunRunning")<{
  readonly session: InFlightRunSession<InFlightRunControlState>
  readonly sequence: number
  readonly program: Program
}> {
  static start({
    token,
    sequence,
    control,
    ownership,
    program,
    facts = RunInternalFacts.fromOwnership(ownership),
    telemetry = RunRuntimeTelemetryState.empty(),
    draft = null,
    identity = null,
    localProjectionScript = null,
    localRunFrame = null,
    canonicalFrame = null,
    choreography = initialChoreographyState
  }: {
    readonly token: number
    readonly sequence: number
    readonly control: InFlightRunControlState
    readonly ownership: RunOwnership
    readonly program: Program
    readonly facts?: RunInternalFacts
    readonly telemetry?: RunRuntimeTelemetryState
    readonly draft?: EntryDraft | null
    readonly identity?: EntryRunIdentity | null
    readonly localProjectionScript?: LocalProjectionScript | null
    readonly localRunFrame?: LocalRunFrame | null
    readonly canonicalFrame?: CanonicalFrame | null
    readonly choreography?: ChoreographyState
  }): RunInFlightState {
    return RunInFlightState.make(RunSession.inFlight({
      token,
      sequence,
      control,
      ownership,
      program,
      facts,
      telemetry,
      draft,
      identity,
      localProjectionScript,
      localRunFrame,
      canonicalFrame,
      choreography
    }))
  }

  static make(session: InFlightRunSession<InFlightRunControlState>): RunInFlightState {
    return new RunInFlightState({
      session,
      sequence: session.sequence,
      program: session.program
    })
  }

  static is(
    state: RunIdleState | RunInFlightState | RunFailedState | RunSuccessState
  ): state is RunInFlightState {
    return state._tag === "RunRunning"
  }

  static hasSequence(
    state: RunIdleState | RunInFlightState | RunFailedState | RunSuccessState,
    sequence: number
  ): state is RunInFlightState {
    return RunInFlightState.is(state) && state.session.sequence === sequence
  }

  private update({
    control = this.session.control,
    facts = this.session.facts,
    telemetry = this.session.telemetry,
    draft = this.session.draft,
    identity = this.session.identity,
    localProjectionScript = this.session.localProjectionScript,
    localRunFrame = this.session.localRunFrame,
    canonicalFrame = this.session.canonicalFrame,
    choreography = this.session.choreography
  }: {
    readonly control?: InFlightRunControlState
    readonly facts?: RunInternalFacts
    readonly telemetry?: RunRuntimeTelemetryState
    readonly draft?: EntryDraft | null
    readonly identity?: EntryRunIdentity | null
    readonly localProjectionScript?: LocalProjectionScript | null
    readonly localRunFrame?: LocalRunFrame | null
    readonly canonicalFrame?: CanonicalFrame | null
    readonly choreography?: ChoreographyState
  } = {}): RunInFlightState {
    return RunInFlightState.start({
      token: this.session.token,
      sequence: this.sequence,
      control,
      ownership: this.session.ownership,
      program: this.program,
      facts,
      telemetry,
      draft,
      identity,
      localProjectionScript,
      localRunFrame,
      canonicalFrame,
      choreography
    })
  }

  observeTelemetry(event: RunRuntimeTelemetryEvent): RunInFlightState {
    return this.update({ telemetry: this.session.telemetry.append(event) })
  }

  withFacts(facts: RunInternalFacts): RunInFlightState {
    return this.update({ facts })
  }

  withLocalRunFrame(localRunFrame: LocalRunFrame): RunInFlightState {
    return this.update({ localRunFrame })
  }

  withCanonicalFrame(canonicalFrame: CanonicalFrame): RunInFlightState {
    return this.update({ canonicalFrame })
  }

  withChoreography(choreography: ChoreographyState): RunInFlightState {
    return this.update({ choreography })
  }

  observeStreamCompletion({
    observedAtMs,
    summary,
    meta
  }: {
    readonly observedAtMs: number
    readonly summary: string
    readonly meta: Metadata | null
  }): RunInFlightState {
    return this.update({
      facts: this.session.facts.observeStreamCompletion({ observedAtMs, summary, meta }),
      telemetry: this.session.telemetry.append({
        kind: "stream-complete-observed",
        atMs: observedAtMs,
        detail: null
      })
    })
  }

  observeStepQueueDrain(observedAtMs: number): RunInFlightState {
    return this.update({
      facts: this.session.facts.observeStepQueueDrain(observedAtMs),
      telemetry: this.session.telemetry.append({
        kind: "step-queue-drained",
        atMs: observedAtMs,
        detail: null
      })
    })
  }

  paused(requestedAtMs: number): RunInFlightState {
    return this.update({
      control: "paused",
      telemetry: this.session.telemetry.append({
        kind: "pause-requested",
        atMs: requestedAtMs,
        detail: null
      })
    })
  }

  resumed(requestedAtMs: number): RunInFlightState {
    return this.update({
      control: "running",
      telemetry: this.session.telemetry.append({
        kind: "resume-requested",
        atMs: requestedAtMs,
        detail: null
      })
    })
  }

  stopping(requestedAtMs: number): RunInFlightState {
    return this.update({
      control: "stopping",
      telemetry: this.session.telemetry.append({
        kind: "stop-requested",
        atMs: requestedAtMs,
        detail: null
      })
    })
  }

  stopped(stoppedAtMs: number): RunIdleState {
    return RunIdleState.make(RunSession.stopped({
      state: this,
      telemetry: this.session.telemetry.append({
        kind: "run-finalized",
        atMs: stoppedAtMs,
        detail: "stopped"
      })
    }))
  }

  failed({
    error,
    finalizedAtMs
  }: {
    readonly error: EntryError
    readonly finalizedAtMs: number
  }): RunFailedState {
    return RunFailedState.fromInFlight({
      error,
      state: this.observeTelemetry({
        kind: "run-finalized",
        atMs: finalizedAtMs,
        detail: "failed"
      })
    })
  }

  succeeded({
    data,
    meta,
    finalizedAtMs
  }: {
    readonly data: RunData
    readonly meta: Metadata | null
    readonly finalizedAtMs: number
  }): RunSuccessState {
    return RunSuccessState.fromInFlight({
      data,
      meta,
      state: this.observeTelemetry({
        kind: "run-finalized",
        atMs: finalizedAtMs,
        detail: "succeeded"
      })
    })
  }
}
