import { Data } from "effect"

import type { EntryError } from "../../../contracts/entry-error.js"
import type { Metadata } from "../../../contracts/envelope.js"
import type { Program } from "../../../contracts/presentation/program.js"
import type { RunData } from "../../../contracts/study/run.js"

import type { RunInFlightState } from "./in-flight-state.js"
import { RunSession, type TerminalRunSession } from "./session.js"

export class RunFailedState extends Data.TaggedClass("RunFailed")<{
  readonly session: TerminalRunSession<"failed">
  readonly sequence: number
  readonly program: Program
  readonly error: EntryError
}> {
  static fromInFlight({
    error,
    state
  }: {
    readonly error: EntryError
    readonly state: RunInFlightState
  }): RunFailedState {
    return new RunFailedState({
      session: RunSession.terminal({ state, outcome: "failed" }),
      sequence: state.sequence,
      program: state.program,
      error
    })
  }
}

export class RunSuccessState extends Data.TaggedClass("RunSuccess")<{
  readonly session: TerminalRunSession<"succeeded">
  readonly sequence: number
  readonly data: RunData
  readonly meta: Metadata | null
}> {
  static fromInFlight({
    data,
    meta,
    state
  }: {
    readonly data: RunData
    readonly meta: Metadata | null
    readonly state: RunInFlightState
  }): RunSuccessState {
    return new RunSuccessState({
      session: RunSession.terminal({ state, outcome: "succeeded" }),
      sequence: state.sequence,
      data,
      meta
    })
  }
}
