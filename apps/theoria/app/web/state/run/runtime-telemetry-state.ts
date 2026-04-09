import { Data } from "effect"

import type { RunOwnership } from "./types.js"
import { type RunRuntimeTelemetryEvent } from "./types.js"

export class RunRuntimeTelemetryState extends Data.Class<RunRuntimeTelemetryState.Shape> {
  static empty(): RunRuntimeTelemetryState {
    return new RunRuntimeTelemetryState({
      startedAtMs: null,
      events: []
    })
  }

  static started({
    ownership,
    startedAtMs
  }: {
    readonly ownership: RunOwnership
    readonly startedAtMs: number
  }): RunRuntimeTelemetryState {
    return new RunRuntimeTelemetryState({
      startedAtMs,
      events: [{ kind: "run-started", atMs: startedAtMs, detail: ownership.detail() }]
    })
  }

  static append(telemetry: RunRuntimeTelemetryState, event: RunRuntimeTelemetryEvent): RunRuntimeTelemetryState {
    return telemetry.startedAtMs === null
      ? new RunRuntimeTelemetryState(telemetry)
      : new RunRuntimeTelemetryState({
        ...telemetry,
        events: [...telemetry.events, event]
      })
  }

  append(event: RunRuntimeTelemetryEvent): RunRuntimeTelemetryState {
    return RunRuntimeTelemetryState.append(this, event)
  }
}

export namespace RunRuntimeTelemetryState {
  export interface Shape {
    readonly startedAtMs: number | null
    readonly events: ReadonlyArray<RunRuntimeTelemetryEvent>
  }
}
