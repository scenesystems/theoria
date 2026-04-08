import { Match } from "effect"

import type { DemoError } from "../../../contracts/demo-error.js"
import type { EntryDraft } from "../../../contracts/entry/registry.js"
import type { Metadata } from "../../../contracts/envelope.js"
import type { Program } from "../../../contracts/presentation/program.js"
import type { EntryRunIdentity } from "../../../contracts/study/run-plan.js"
import type { RunData } from "../../../contracts/study/run.js"
import type { CanonicalFrame } from "../../../contracts/study/workflow/canonical-step.js"
import type { ChoreographyState } from "../../../contracts/study/workflow/choreography.js"

export type { LocalProjectionScript, LocalRunFrame } from "./local.js"

import type { LocalProjectionScript, LocalRunFrame } from "./local.js"

export type RunControlActionKind = "run" | "pause" | "resume" | "stop" | "reset"
export type RunControlState = "idle" | "running" | "paused" | "stopping"
export type RunOutcome = "none" | "failed" | "succeeded"

export type RunOwnership = {
  readonly localDriver: boolean
  readonly serverStream: boolean
}

export type RunInternalFactState = "inactive" | "pending" | "observed"

export type RunStreamCompletionFact = {
  readonly state: RunInternalFactState
  readonly observedAtMs: number | null
  readonly summary: string | null
  readonly meta: Metadata | null
}

export type RunStepQueueDrainFact = {
  readonly state: RunInternalFactState
  readonly observedAtMs: number | null
}

export type RunInternalFacts = {
  readonly streamComplete: RunStreamCompletionFact
  readonly stepQueueDrain: RunStepQueueDrainFact
}

export type RunRuntimeTelemetryKind =
  | "run-started"
  | "pause-requested"
  | "resume-requested"
  | "stop-requested"
  | "checkpoint-reached"
  | "stream-complete-observed"
  | "step-queue-drained"
  | "run-finalized"

export type RunRuntimeTelemetryEvent = {
  readonly kind: RunRuntimeTelemetryKind
  readonly atMs: number
  readonly detail: string | null
}

export type RunRuntimeTelemetryState = {
  readonly startedAtMs: number | null
  readonly events: ReadonlyArray<RunRuntimeTelemetryEvent>
}

export type RunSession = {
  readonly token: number | null
  readonly sequence: number | null
  readonly control: RunControlState
  readonly outcome: RunOutcome
  readonly ownership: RunOwnership
  readonly facts: RunInternalFacts
  readonly telemetry: RunRuntimeTelemetryState
  readonly draft: EntryDraft | null
  readonly identity: EntryRunIdentity | null
  readonly localProjectionScript: LocalProjectionScript | null
  readonly localRunFrame: LocalRunFrame | null
  readonly canonicalFrame: CanonicalFrame | null
  readonly choreography: ChoreographyState
  readonly program: Program | null
}

type ActiveRunSession = RunSession & {
  readonly token: number
  readonly sequence: number
  readonly program: Program
}

export type RunInFlightState = {
  readonly _tag: "RunRunning"
  readonly session: ActiveRunSession & {
    readonly outcome: "none"
    readonly control: Exclude<RunControlState, "idle">
  }
  readonly sequence: number
  readonly program: Program
}

export type RunState =
  | { readonly _tag: "RunIdle"; readonly session: RunSession }
  | RunInFlightState
  | {
    readonly _tag: "RunFailed"
    readonly session: ActiveRunSession & {
      readonly control: "idle"
      readonly outcome: "failed"
    }
    readonly sequence: number
    readonly program: Program
    readonly error: DemoError
  }
  | {
    readonly _tag: "RunSuccess"
    readonly session: ActiveRunSession & {
      readonly control: "idle"
      readonly outcome: "succeeded"
    }
    readonly sequence: number
    readonly data: RunData
    readonly meta: Metadata | null
  }

export type RunPhase = "idle" | "running" | "paused" | "stopping" | "failed" | "success"

const isRunInternalFactPending = (state: RunInternalFactState): boolean => state === "pending"

const isRunInternalFactObserved = (state: RunInternalFactState): boolean => state === "observed"

const runFactsReady = (facts: RunInternalFacts): boolean =>
  !isRunInternalFactPending(facts.streamComplete.state) && !isRunInternalFactPending(facts.stepQueueDrain.state)

export const runHasStreamCompletion = (run: RunState): boolean =>
  isRunInternalFactObserved(run.session.facts.streamComplete.state)

export const runHasStepQueueDrain = (run: RunState): boolean =>
  isRunInternalFactObserved(run.session.facts.stepQueueDrain.state)

export const runAwaitsStreamCompletion = (run: RunState): boolean =>
  isRunInternalFactPending(run.session.facts.streamComplete.state)

export const runAwaitsStepQueueDrain = (run: RunState): boolean =>
  isRunInternalFactPending(run.session.facts.stepQueueDrain.state)

export const runStreamCompletionSummary = (run: RunState): string | null => run.session.facts.streamComplete.summary

export const runPhase = (run: RunState): RunPhase =>
  Match.value(run.session.outcome).pipe(
    Match.withReturnType<RunPhase>(),
    Match.when("failed", () => "failed"),
    Match.when("succeeded", () => "success"),
    Match.orElse(() =>
      Match.value(run.session.control).pipe(
        Match.withReturnType<RunPhase>(),
        Match.when("running", () => "running"),
        Match.when("paused", () => "paused"),
        Match.when("stopping", () => "stopping"),
        Match.orElse(() => "idle")
      )
    )
  )

export const hasActiveRunSequence = (run: RunState, sequence: number): boolean =>
  run.session.sequence === sequence && run.session.outcome === "none" && run.session.control !== "idle"

export const programFromRunState = (run: RunState): Program | null =>
  Match.value(run).pipe(
    Match.tag("RunRunning", ({ program }) => program),
    Match.tag("RunFailed", ({ program }) => program),
    Match.tag("RunSuccess", ({ data }) => data.program),
    Match.orElse(() => null)
  )

export const runSuccessGateSatisfied = (run: RunInFlightState): boolean => runFactsReady(run.session.facts)
