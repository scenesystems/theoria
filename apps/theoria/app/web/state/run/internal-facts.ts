import { Data } from "effect"

import type { Metadata } from "../../../contracts/envelope.js"

import type { RunOwnership } from "./types.js"
import { type RunStepQueueDrainFact, type RunStreamCompletionFact } from "./types.js"

export class RunInternalFacts extends Data.Class<RunInternalFacts.Shape> {
  static inactive(): RunInternalFacts {
    return new RunInternalFacts({
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
    })
  }

  static fromOwnership(ownership: RunOwnership): RunInternalFacts {
    const inactive = RunInternalFacts.inactive()

    return new RunInternalFacts({
      streamComplete: ownership.serverStream
        ? {
          state: "pending",
          observedAtMs: null,
          summary: null,
          meta: null
        }
        : inactive.streamComplete,
      stepQueueDrain: ownership.projectionDriver
        ? {
          state: "pending",
          observedAtMs: null
        }
        : inactive.stepQueueDrain
    })
  }

  static successGateSatisfied(facts: RunInternalFacts): boolean {
    return !facts.awaitsStreamCompletion() && !facts.awaitsStepQueueDrain()
  }

  static observeStreamCompletion(
    facts: RunInternalFacts,
    {
      observedAtMs,
      summary,
      meta
    }: {
      readonly observedAtMs: number
      readonly summary: string
      readonly meta: Metadata | null
    }
  ): RunInternalFacts {
    return new RunInternalFacts({
      ...facts,
      streamComplete: {
        state: facts.streamComplete.state === "inactive" ? "inactive" : "observed",
        observedAtMs: facts.streamComplete.state === "inactive" ? null : observedAtMs,
        summary,
        meta
      }
    })
  }

  static observeStepQueueDrain(facts: RunInternalFacts, observedAtMs: number): RunInternalFacts {
    return new RunInternalFacts({
      ...facts,
      stepQueueDrain: {
        state: facts.stepQueueDrain.state === "inactive" ? "inactive" : "observed",
        observedAtMs: facts.stepQueueDrain.state === "inactive" ? null : observedAtMs
      }
    })
  }

  hasStreamCompletion(): boolean {
    return this.streamComplete.state === "observed"
  }

  hasStepQueueDrain(): boolean {
    return this.stepQueueDrain.state === "observed"
  }

  awaitsStreamCompletion(): boolean {
    return this.streamComplete.state === "pending"
  }

  awaitsStepQueueDrain(): boolean {
    return this.stepQueueDrain.state === "pending"
  }

  streamCompletionSummary(): string | null {
    return this.streamComplete.summary
  }

  successGateSatisfied(): boolean {
    return RunInternalFacts.successGateSatisfied(this)
  }

  observeStreamCompletion({
    observedAtMs,
    summary,
    meta
  }: {
    readonly observedAtMs: number
    readonly summary: string
    readonly meta: Metadata | null
  }): RunInternalFacts {
    return RunInternalFacts.observeStreamCompletion(this, { observedAtMs, summary, meta })
  }

  observeStepQueueDrain(observedAtMs: number): RunInternalFacts {
    return RunInternalFacts.observeStepQueueDrain(this, observedAtMs)
  }
}

export namespace RunInternalFacts {
  export interface Shape {
    readonly streamComplete: RunStreamCompletionFact
    readonly stepQueueDrain: RunStepQueueDrainFact
  }
}
