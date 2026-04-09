import { Data, Schema } from "effect"

import { Metadata } from "../../../contracts/envelope.js"

export type {
  ActiveIdleRunSession,
  ActiveRunSession,
  InFlightRunControlState,
  InFlightRunSession,
  LocalProjectionScript,
  LocalRunFrame,
  RunSession,
  TerminalRunSession
} from "./session.js"

export type { RunFailedState, RunIdleState, RunInFlightState, RunState, RunSuccessState } from "./state.js"

export const RunControlActionKind = Schema.Literal("run", "pause", "resume", "stop", "reset")

export type RunControlActionKind = typeof RunControlActionKind.Type

export const RunControlState = Schema.Literal("idle", "running", "paused", "stopping")

export type RunControlState = typeof RunControlState.Type

export const RunOutcome = Schema.Literal("none", "failed", "succeeded")

export type RunOutcome = typeof RunOutcome.Type

export class RunOwnership extends Data.Class<RunOwnership.Shape> {
  static make(ownership: RunOwnership.Shape): RunOwnership {
    return new RunOwnership(ownership)
  }

  static empty(): RunOwnership {
    return RunOwnership.make({
      projectionDriver: false,
      serverStream: false
    })
  }

  static serverOnly(): RunOwnership {
    return RunOwnership.make({
      projectionDriver: false,
      serverStream: true
    })
  }

  static sharedStreaming(): RunOwnership {
    return RunOwnership.make({
      projectionDriver: true,
      serverStream: true
    })
  }

  static detail(ownership: RunOwnership): string {
    return `projection ${ownership.projectionDriver ? "yes" : "no"} | server ${ownership.serverStream ? "yes" : "no"}`
  }

  detail(): string {
    return RunOwnership.detail(this)
  }
}

export namespace RunOwnership {
  export interface Shape {
    readonly projectionDriver: boolean
    readonly serverStream: boolean
  }
}

export const RunOwnershipSchema = Schema.Struct({
  projectionDriver: Schema.Boolean,
  serverStream: Schema.Boolean
})

export const RunInternalFactState = Schema.Literal("inactive", "pending", "observed")

export type RunInternalFactState = typeof RunInternalFactState.Type

export const RunStreamCompletionFact = Schema.Struct({
  state: RunInternalFactState,
  observedAtMs: Schema.NullOr(Schema.Number),
  summary: Schema.NullOr(Schema.String),
  meta: Schema.NullOr(Metadata)
})

export type RunStreamCompletionFact = typeof RunStreamCompletionFact.Type

export const RunStepQueueDrainFact = Schema.Struct({
  state: RunInternalFactState,
  observedAtMs: Schema.NullOr(Schema.Number)
})

export type RunStepQueueDrainFact = typeof RunStepQueueDrainFact.Type

export const RunRuntimeTelemetryKind = Schema.Literal(
  "run-started",
  "pause-requested",
  "resume-requested",
  "stop-requested",
  "checkpoint-reached",
  "stream-complete-observed",
  "step-queue-drained",
  "run-finalized"
)

export type RunRuntimeTelemetryKind = typeof RunRuntimeTelemetryKind.Type

export const RunRuntimeTelemetryEvent = Schema.Struct({
  kind: RunRuntimeTelemetryKind,
  atMs: Schema.Number,
  detail: Schema.NullOr(Schema.String)
})

export type RunRuntimeTelemetryEvent = typeof RunRuntimeTelemetryEvent.Type

export const RunPhase = Schema.Literal("idle", "running", "paused", "stopping", "failed", "success")

export type RunPhase = typeof RunPhase.Type
