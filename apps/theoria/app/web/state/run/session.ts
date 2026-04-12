import { Data } from "effect"

import type { EntryDraft } from "../../../contracts/entry/registry.js"
import type { Program } from "../../../contracts/presentation/program.js"
import type { RunRequestIdentity } from "../../../contracts/study/run-plan.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import { type ChoreographyState, initialChoreographyState } from "../../../contracts/study/workflow/choreography.js"

export type { LocalProjectionScript, LocalRunFrame } from "./local.js"
import { RunInternalFacts } from "./internal-facts.js"
import type { LocalProjectionScript, LocalRunFrame } from "./local.js"
import { RunRuntimeTelemetryState } from "./runtime-telemetry-state.js"
import { type RunControlState, type RunInFlightState, type RunOutcome, RunOwnership, type RunPhase } from "./types.js"

export type InFlightRunControlState = Exclude<RunControlState, "idle">

export type ActiveRunSession = RunSession<RunControlState, RunOutcome, number, number, Program>

export type ActiveIdleRunSession = RunSession<"idle", "none", number, number, Program>

export type InFlightRunSession<Control extends InFlightRunControlState = InFlightRunControlState> = RunSession<
  Control,
  "none",
  number,
  number,
  Program
>

export type TerminalRunSession<Outcome extends Exclude<RunOutcome, "none"> = Exclude<RunOutcome, "none">> = RunSession<
  "idle",
  Outcome,
  number,
  number,
  Program
>

export class RunSession<
  Control extends RunControlState = RunControlState,
  Outcome extends RunOutcome = RunOutcome,
  Token extends number | null = number | null,
  Sequence extends number | null = number | null,
  ProgramState extends Program | null = Program | null
> extends Data.Class<RunSession.Shape<Control, Outcome, Token, Sequence, ProgramState>> {
  static idle(): RunSession<"idle", "none", null, null, null> {
    return new RunSession<"idle", "none", null, null, null>({
      token: null,
      sequence: null,
      control: "idle",
      outcome: "none",
      ownership: RunOwnership.empty(),
      facts: RunInternalFacts.inactive(),
      telemetry: RunRuntimeTelemetryState.empty(),
      draft: null,
      identity: null,
      localProjectionScript: null,
      localRunFrame: null,
      canonicalFrame: null,
      choreography: initialChoreographyState,
      program: null
    })
  }

  static inFlight<Control extends InFlightRunControlState>({
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
  }: {
    readonly token: number
    readonly sequence: number
    readonly control: Control
    readonly ownership: RunOwnership
    readonly program: Program
    readonly facts: RunInternalFacts
    readonly telemetry: RunRuntimeTelemetryState
    readonly draft: EntryDraft | null
    readonly identity: RunRequestIdentity | null
    readonly localProjectionScript: LocalProjectionScript | null
    readonly localRunFrame: LocalRunFrame | null
    readonly canonicalFrame: CanonicalFrame | null
    readonly choreography: ChoreographyState
  }): InFlightRunSession<Control> {
    return new RunSession<Control, "none", number, number, Program>({
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
    })
  }

  static terminal<Outcome extends Exclude<RunOutcome, "none">>({
    outcome,
    state
  }: {
    readonly outcome: Outcome
    readonly state: RunInFlightState
  }): TerminalRunSession<Outcome> {
    return new RunSession<"idle", Outcome, number, number, Program>({
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
  }

  static stopped({
    state,
    telemetry
  }: {
    readonly state: RunInFlightState
    readonly telemetry: RunRuntimeTelemetryState
  }): ActiveIdleRunSession {
    return new RunSession<"idle", "none", number, number, Program>({
      token: state.session.token,
      sequence: state.session.sequence,
      control: "idle",
      outcome: "none",
      ownership: state.session.ownership,
      facts: state.session.facts,
      telemetry,
      draft: state.session.draft,
      identity: state.session.identity,
      localProjectionScript: state.session.localProjectionScript,
      localRunFrame: state.session.localRunFrame,
      canonicalFrame: state.session.canonicalFrame,
      choreography: state.session.choreography,
      program: state.program
    })
  }

  static phase(session: RunSession): RunPhase {
    if (session.outcome === "failed") {
      return "failed"
    }

    if (session.outcome === "succeeded") {
      return "success"
    }

    if (session.control === "running") {
      return "running"
    }

    if (session.control === "paused") {
      return "paused"
    }

    if (session.control === "stopping") {
      return "stopping"
    }

    return "idle"
  }

  static hasActiveSequence(session: RunSession, sequence: number): boolean {
    return session.sequence === sequence && session.outcome === "none" && session.control !== "idle"
  }

  hasActiveSequence(sequence: number): boolean {
    return RunSession.hasActiveSequence(this, sequence)
  }

  phase(): RunPhase {
    return RunSession.phase(this)
  }
}

export namespace RunSession {
  export interface Shape<
    Control extends RunControlState = RunControlState,
    Outcome extends RunOutcome = RunOutcome,
    Token extends number | null = number | null,
    Sequence extends number | null = number | null,
    ProgramState extends Program | null = Program | null
  > {
    readonly token: Token
    readonly sequence: Sequence
    readonly control: Control
    readonly outcome: Outcome
    readonly ownership: RunOwnership
    readonly facts: RunInternalFacts
    readonly telemetry: RunRuntimeTelemetryState
    readonly draft: EntryDraft | null
    readonly identity: RunRequestIdentity | null
    readonly localProjectionScript: LocalProjectionScript | null
    readonly localRunFrame: LocalRunFrame | null
    readonly canonicalFrame: CanonicalFrame | null
    readonly choreography: ChoreographyState
    readonly program: ProgramState
  }
}
