import { Match } from "effect"

import type { ChoreographyState } from "../../../contracts/study/workflow/choreography.js"

import type { EvidenceStreamState } from "../evidence/stream.js"
import type { RunControlState, RunInFlightState } from "./types.js"

export type RunBannerState = {
  readonly tone: "live" | "error" | "complete"
  readonly text: string
}

export type RunInFlightEvidenceControl = Exclude<RunControlState, "idle">

export type RunInFlightEvidenceState = {
  readonly _tag: "RunEvidenceInFlight"
  readonly banner: RunBannerState | null
  readonly control: RunInFlightEvidenceControl
  readonly description: string
}

const formatStageId = (stageId: string): string => stageId.replace(/-/gu, " ")

const liveBanner = (text: string): RunBannerState => ({ tone: "live", text })

const buildRunInFlightEvidenceState = ({
  banner,
  control,
  description
}: {
  readonly banner: RunBannerState | null
  readonly control: RunInFlightEvidenceControl
  readonly description: string
}): RunInFlightEvidenceState => ({
  _tag: "RunEvidenceInFlight",
  banner,
  control,
  description
})

const stageBanner = (choreography: ChoreographyState): RunBannerState | null =>
  Match.value(choreography).pipe(
    Match.tag("Idle", () => null),
    Match.tag("InStage", ({ stageId, step }) => liveBanner(`${formatStageId(stageId)} · step ${step + 1}`)),
    Match.exhaustive
  )

const streamingDescription = ({
  choreography,
  sectionCount
}: {
  readonly choreography: ChoreographyState
  readonly sectionCount: number
}): string =>
  Match.value(choreography).pipe(
    Match.tag("Idle", () => sectionCount === 0 ? "Generating evidence…" : "Collecting evidence…"),
    Match.tag("InStage", ({ stageId }) => `Streaming ${formatStageId(stageId)}…`),
    Match.exhaustive
  )

const pausedDescription = ({
  choreography,
  sectionCount
}: {
  readonly choreography: ChoreographyState
  readonly sectionCount: number
}): string =>
  Match.value(choreography).pipe(
    Match.tag("Idle", () =>
      sectionCount === 0
        ? "Run paused. Resume to continue collecting evidence."
        : "Resume to continue streaming evidence."),
    Match.tag("InStage", ({ stageId }) => `Run paused at ${formatStageId(stageId)}. Resume to continue.`),
    Match.exhaustive
  )

export const runInFlightEvidenceState = ({
  run,
  stream
}: {
  readonly run: RunInFlightState
  readonly stream: EvidenceStreamState
}): RunInFlightEvidenceState => {
  const sectionCount = stream.sections.length
  const choreography = run.session.choreography

  return Match.value(run.session.control).pipe(
    Match.withReturnType<RunInFlightEvidenceState>(),
    Match.when("running", () =>
      buildRunInFlightEvidenceState({
        banner: stageBanner(choreography),
        control: "running",
        description: streamingDescription({ choreography, sectionCount })
      })),
    Match.when("paused", () =>
      buildRunInFlightEvidenceState({
        banner: stageBanner(choreography),
        control: "paused",
        description: pausedDescription({ choreography, sectionCount })
      })),
    Match.when("stopping", () =>
      buildRunInFlightEvidenceState({
        banner: liveBanner("Stopping run…"),
        control: "stopping",
        description: "Stopping run…"
      })),
    Match.exhaustive
  )
}
