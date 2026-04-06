import { Match, Option } from "effect"

import type { DemoError } from "../../contracts/demo-error.js"
import { type EvidenceStatusState, type PreloadState, type RunState } from "./types.js"

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

export const statusFromError = (error: DemoError): string =>
  Match.value(error).pipe(
    Match.tag("DemoRequestError", ({ message }) => compactErrorMessage(message)),
    Match.tag("DemoDecodeError", ({ message }) => `Decode error: ${compactErrorMessage(message)}`),
    Match.tag("DemoExecutionError", (e) =>
      Match.value(e.code).pipe(
        Match.when("execution-timeout", () => "Run timed out. Retry to collect evidence."),
        Match.when("provider-unavailable", () => compactErrorMessage(e.message)),
        Match.when("invalid-demo-id", () => "Demo is unavailable in this runtime build."),
        Match.when("route-not-found", () => "Demo route is unavailable. Refresh and retry."),
        Match.orElse(() => {
          const detail = compactErrorMessage(e.message)
          return detail.length === 0 || detail === "Demo execution failed."
            ? "Demo execution failed. Open Deep Dive for full diagnostics."
            : `Execution failed: ${detail}`
        })
      )),
    Match.exhaustive
  )

export const statusFromPreload = (preload: PreloadState): string =>
  Match.value(preload).pipe(
    Match.tag("PreloadLoading", () => "Preloading program preview…"),
    Match.tag("PreloadFailed", ({ error }) => statusFromError(error)),
    Match.tag("PreloadReady", () => "Program preview ready. Run to generate live evidence."),
    Match.orElse(() => "Run the demo to generate evidence and inspect code provenance.")
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
        ? "Running demo now…"
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
