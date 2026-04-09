import { Match } from "effect"

import type { EvidenceStreamState } from "../evidence/stream.js"

import { type RunBannerState, type RunInFlightEvidenceState, runInFlightEvidenceState } from "./in-flight-evidence.js"
import { statusFromError } from "./status.js"
import type { RunState } from "./types.js"

export type { RunInFlightEvidenceControl } from "./in-flight-evidence.js"

type RunEvidenceBaseState = {
  readonly banner: RunBannerState | null
  readonly description: string
}

export type RunIdleEvidenceState = RunEvidenceBaseState & {
  readonly _tag: "RunEvidenceIdle"
}

export type RunFailureEvidenceState = RunEvidenceBaseState & {
  readonly _tag: "RunEvidenceFailure"
}

export type RunResultsEvidenceState = RunEvidenceBaseState & {
  readonly _tag: "RunEvidenceResults"
}

export type RunEvidenceState =
  | RunIdleEvidenceState
  | RunInFlightEvidenceState
  | RunFailureEvidenceState
  | RunResultsEvidenceState

const runIdleEvidenceState = (): RunIdleEvidenceState => ({
  _tag: "RunEvidenceIdle",
  banner: null,
  description: "Run the study to generate reproducible evidence."
})

const runFailureEvidenceState = ({
  description,
  hasRetainedEvidence
}: {
  readonly description: string
  readonly hasRetainedEvidence: boolean
}): RunFailureEvidenceState => ({
  _tag: "RunEvidenceFailure",
  banner: hasRetainedEvidence
    ? {
      tone: "error",
      text: description
    }
    : null,
  description
})

const runResultsEvidenceState = (description: string): RunResultsEvidenceState => ({
  _tag: "RunEvidenceResults",
  banner: null,
  description
})

export const runEvidenceState = ({
  run,
  stream
}: {
  readonly run: RunState
  readonly stream: EvidenceStreamState
}): RunEvidenceState =>
  Match.value(run).pipe(
    Match.withReturnType<RunEvidenceState>(),
    Match.tag("RunIdle", () => runIdleEvidenceState()),
    Match.tag("RunRunning", (activeRun) => runInFlightEvidenceState({ run: activeRun, stream })),
    Match.tag("RunFailed", ({ error }) =>
      runFailureEvidenceState({
        description: statusFromError(error),
        hasRetainedEvidence: stream.sections.length > 0
      })),
    Match.tag("RunSuccess", ({ data }) => runResultsEvidenceState(data.summary)),
    Match.exhaustive
  )

export const runEvidenceComplete = (state: RunEvidenceState): boolean =>
  Match.value(state).pipe(
    Match.tag("RunEvidenceIdle", () => false),
    Match.tag("RunEvidenceInFlight", () => false),
    Match.tag("RunEvidenceFailure", () => false),
    Match.tag("RunEvidenceResults", () => true),
    Match.exhaustive
  )
