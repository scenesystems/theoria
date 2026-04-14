import { Data } from "effect"

import { RunSession } from "./session.js"

export class RunIdleState extends Data.TaggedClass("RunIdle")<{
  readonly session: RunSession
}> {
  static make(session: RunSession = RunSession.idle()): RunIdleState {
    return new RunIdleState({ session })
  }
}
