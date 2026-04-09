import { Match } from "effect"

import { type WorkflowTargetMode, workflowTargetModeLabel } from "./controls.js"

export type WorkflowRenderedPreviewMetric =
  | "authored-optimized-score"
  | "baseline-score"
  | "search-winner-score"
  | "winner-delta-vs-authored-optimized"
  | "winner-delta-vs-baseline"

export type WorkflowRenderedPreviewPane = "baseline" | "replay-target"

export const workflowRenderedPreviewDescription = ({
  hasReplayOutput,
  targetMode
}: {
  readonly hasReplayOutput: boolean
  readonly targetMode: WorkflowTargetMode
}): string =>
  !hasReplayOutput
    ? "Rendered preview stays empty until the canonical ledger yields baseline and winner outputs."
    : targetMode === "authored-optimized"
    ? "These previews stay on the same execution record while keeping the study winner evidence available separately in the progress lane."
    : "These previews stay on the same execution record as the graph cards and evidence stack."

export const workflowRenderedPreviewFallback = ({
  pane,
  targetMode
}: {
  readonly pane: WorkflowRenderedPreviewPane
  readonly targetMode: WorkflowTargetMode
}): string =>
  pane === "baseline"
    ? "Await the baseline replay to materialize a human-facing output preview."
    : targetMode === "authored-optimized"
    ? "Await the authored optimized replay to materialize the final output preview."
    : "Await the frozen replay target to materialize the final output preview."

export const workflowRenderedPreviewTargetLabel = (targetMode: WorkflowTargetMode): string =>
  `${workflowTargetModeLabel(targetMode)} Replay`

export const workflowRenderedPreviewMetricLabel = (metric: WorkflowRenderedPreviewMetric): string =>
  Match.value(metric).pipe(
    Match.when("baseline-score", () => "Baseline score"),
    Match.when("authored-optimized-score", () => "Authored optimized score"),
    Match.when("search-winner-score", () => "Search winner score"),
    Match.when("winner-delta-vs-baseline", () => "Winner delta vs baseline"),
    Match.when("winner-delta-vs-authored-optimized", () => "Winner delta vs authored optimized"),
    Match.exhaustive
  )

export const workflowRenderedPreviewPaneLabel = ({
  pane,
  targetMode
}: {
  readonly pane: WorkflowRenderedPreviewPane
  readonly targetMode: WorkflowTargetMode
}): string => pane === "baseline" ? "Baseline Output" : workflowRenderedPreviewTargetLabel(targetMode)

export const workflowRenderedPreviewPaneNote = ({
  isCurrent,
  nodeId,
  pane
}: {
  readonly isCurrent: boolean
  readonly nodeId: string | null
  readonly pane: WorkflowRenderedPreviewPane
}): string =>
  nodeId === null
    ? pane === "baseline"
      ? "Baseline response"
      : "Replay target response"
    : isCurrent
    ? `${nodeId} · current canonical output`
    : nodeId

export const workflowRenderedPreviewScoreLabel = (score: string): string => `score ${score}`
