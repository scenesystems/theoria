import { Match, Option } from "effect"

import type { EntryError, EntryExecutionError } from "../../../contracts/entry-error.js"
import type { EvidenceStatusState } from "../evidence/stream.js"
import type { PreloadState } from "../surface/state.js"
import type { RunState } from "./types.js"

export type SurfaceStatusState = {
  readonly preload: PreloadState
  readonly run: RunState
}

export const compactErrorMessage = (message: string): string => {
  const firstLine = message.split("\n")[0] ?? ""
  const normalized = firstLine.replace(/\s+/gu, " ").trim()

  return normalized.length > 140
    ? `${normalized.slice(0, 139)}…`
    : normalized
}

const executionFailedStatus = (error: EntryExecutionError): string => {
  const detail = compactErrorMessage(error.message)

  return detail.length === 0 || detail === "Entry execution failed."
    ? "Entry execution failed. Open Deep Dive for full diagnostics."
    : `Execution failed: ${detail}`
}

const statusFromExecutionError = (error: EntryExecutionError): string =>
  Match.value(error.code).pipe(
    Match.when("execution-timeout", () => "Run timed out. Retry to collect evidence."),
    Match.when("provider-unavailable", () => compactErrorMessage(error.message)),
    Match.when("invalid-entry-id", () => "Entry is unavailable in this runtime build."),
    Match.when("invalid-package-id", () => compactErrorMessage(error.message)),
    Match.when("invalid-query", () => compactErrorMessage(error.message)),
    Match.when("route-not-found", () => "Entry route is unavailable. Refresh and retry."),
    Match.when("execution-failed", () => executionFailedStatus(error)),
    Match.exhaustive
  )

export const statusFromError = (error: EntryError): string =>
  Match.value(error).pipe(
    Match.tag("EntryRequestError", ({ message }) => compactErrorMessage(message)),
    Match.tag("EntryDecodeError", ({ message }) => `Decode error: ${compactErrorMessage(message)}`),
    Match.tag("EntryExecutionError", statusFromExecutionError),
    Match.exhaustive
  )

export const statusFromPreload = (preload: PreloadState): string =>
  Match.value(preload).pipe(
    Match.tag("PreloadLoading", () => "Preloading program preview…"),
    Match.tag("PreloadFailed", ({ error }) => statusFromError(error)),
    Match.tag("PreloadReady", () => "Program preview ready. Run to generate live evidence."),
    Match.orElse(() => "Run the study to generate evidence and inspect code provenance.")
  )

const formatStageId = (stageId: string): string => stageId.replace(/-/gu, " ")

const stageStatusText = (run: RunState): string | null =>
  run.session.choreography._tag === "InStage"
    ? `Streaming ${formatStageId(run.session.choreography.stageId)}…`
    : null

const runningStatusText = (run: RunState, evidence: EvidenceStatusState): string =>
  Option.match(Option.fromNullable(stageStatusText(run)), {
    onSome: (stageText) => stageText,
    onNone: () =>
      evidence.sectionCount === 0
        ? "Running study now…"
        : `Streaming results… ${evidence.sectionCount} section${evidence.sectionCount === 1 ? "" : "s"} loaded.`
  })

const pausedStatusText = (run: RunState, evidence: EvidenceStatusState): string =>
  Option.match(
    run.session.choreography._tag === "InStage"
      ? Option.some(run.session.choreography.stageId)
      : Option.none<string>(),
    {
      onSome: (stageId) => `Run paused at ${formatStageId(stageId)}. Resume to continue.`,
      onNone: () =>
        evidence.sectionCount === 0
          ? "Run paused before evidence arrived. Resume to continue."
          : "Run paused. Resume to continue streaming evidence."
    }
  )

const runningControlStatusText = (run: RunState, evidence: EvidenceStatusState): string =>
  run.session.control === "paused"
    ? pausedStatusText(run, evidence)
    : run.session.control === "stopping"
    ? "Stopping run…"
    : runningStatusText(run, evidence)

export const statusText = (state: SurfaceStatusState, evidence: EvidenceStatusState): string =>
  Match.value(state.run).pipe(
    Match.tag("RunRunning", (run) => runningControlStatusText(run, evidence)),
    Match.tag("RunFailed", ({ error }) => {
      const baseMessage = statusFromError(error)

      return evidence.sectionCount === 0
        ? baseMessage
        : `${baseMessage} Partial results remain visible.`
    }),
    Match.tag("RunSuccess", ({ data }) => data.summary),
    Match.orElse(() => statusFromPreload(state.preload))
  )
