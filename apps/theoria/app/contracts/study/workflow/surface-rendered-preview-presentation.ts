import { Match, Schema } from "effect"

import { type WorkflowTargetMode, workflowTargetModeLabel } from "./controls.js"
import type { WorkflowGraphViewModel } from "./surface-graph-presentation.js"
import {
  workflowDeltaText,
  WorkflowRenderedPreviewPaneKeySchema,
  type WorkflowTranscriptViewModel
} from "./view-presentation.js"

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

type WorkflowRenderedPreviewOutput = {
  readonly isCurrent: boolean
  readonly nodeId: string
  readonly output: string
} | null

export class WorkflowRenderedPreviewPaneViewModel extends Schema.Class<WorkflowRenderedPreviewPaneViewModel>(
  "WorkflowRenderedPreviewPaneViewModel"
)({
  key: WorkflowRenderedPreviewPaneKeySchema,
  label: Schema.String,
  score: Schema.String,
  body: Schema.String,
  note: Schema.String
}) {}

export class WorkflowRenderedPreviewMetricViewModel extends Schema.Class<WorkflowRenderedPreviewMetricViewModel>(
  "WorkflowRenderedPreviewMetricViewModel"
)({
  label: Schema.String,
  value: Schema.String
}) {}

export class WorkflowRenderedPreviewViewModel extends Schema.Class<WorkflowRenderedPreviewViewModel>(
  "WorkflowRenderedPreviewViewModel"
)({
  description: Schema.String,
  panes: Schema.Array(WorkflowRenderedPreviewPaneViewModel),
  metrics: Schema.Array(WorkflowRenderedPreviewMetricViewModel)
}) {
  static project({
    graph,
    plan,
    transcript
  }: {
    readonly graph: WorkflowGraphViewModel
    readonly plan: {
      readonly controls: {
        readonly targetMode: WorkflowTargetMode
      }
    }
    readonly transcript: WorkflowTranscriptViewModel
  }): WorkflowRenderedPreviewViewModel {
    const baselineOutput = latestOutputFor(transcript, "baseline")
    const workflowTargetOutput = latestOutputFor(transcript, "optimized")
    const { authoredOptimized, baseline, searchWinner } = graph.cardCatalog
    const baselineScore = numericScore(baseline.score)
    const authoredScore = numericScore(authoredOptimized.score)
    const winnerScore = numericScore(searchWinner.score)
    const targetCard = Match.value(plan.controls.targetMode).pipe(
      Match.when("authored-optimized", () => authoredOptimized),
      Match.when("search-winner", () => searchWinner),
      Match.exhaustive
    )

    return WorkflowRenderedPreviewViewModel.make({
      description: workflowRenderedPreviewDescription({
        hasReplayOutput: workflowTargetOutput !== null,
        targetMode: plan.controls.targetMode
      }),
      panes: [
        WorkflowRenderedPreviewPaneViewModel.make({
          key: "baseline",
          label: workflowRenderedPreviewPaneLabel({ pane: "baseline", targetMode: plan.controls.targetMode }),
          score: baseline.score,
          body: baselineOutput?.output ??
            workflowRenderedPreviewFallback({ pane: "baseline", targetMode: plan.controls.targetMode }),
          note: workflowRenderedPreviewPaneNote({
            isCurrent: false,
            nodeId: baselineOutput?.nodeId ?? null,
            pane: "baseline"
          })
        }),
        WorkflowRenderedPreviewPaneViewModel.make({
          key: "replay-target",
          label: workflowRenderedPreviewPaneLabel({ pane: "replay-target", targetMode: plan.controls.targetMode }),
          score: targetCard.score,
          body: workflowTargetOutput?.output ??
            workflowRenderedPreviewFallback({ pane: "replay-target", targetMode: plan.controls.targetMode }),
          note: workflowRenderedPreviewPaneNote({
            isCurrent: workflowTargetOutput?.isCurrent ?? false,
            nodeId: workflowTargetOutput?.nodeId ?? null,
            pane: "replay-target"
          })
        })
      ],
      metrics: [
        WorkflowRenderedPreviewMetricViewModel.make({
          label: workflowRenderedPreviewMetricLabel("baseline-score"),
          value: baseline.score
        }),
        WorkflowRenderedPreviewMetricViewModel.make({
          label: workflowRenderedPreviewMetricLabel("authored-optimized-score"),
          value: authoredOptimized.score
        }),
        WorkflowRenderedPreviewMetricViewModel.make({
          label: workflowRenderedPreviewMetricLabel("search-winner-score"),
          value: searchWinner.score
        }),
        WorkflowRenderedPreviewMetricViewModel.make({
          label: workflowRenderedPreviewMetricLabel("winner-delta-vs-baseline"),
          value: workflowDeltaText({ baseline: baselineScore, digits: 3, improved: winnerScore })
        }),
        WorkflowRenderedPreviewMetricViewModel.make({
          label: workflowRenderedPreviewMetricLabel("winner-delta-vs-authored-optimized"),
          value: workflowDeltaText({ baseline: authoredScore, digits: 3, improved: winnerScore })
        })
      ]
    })
  }
}

const numericScore = (score: string): number | null => (score === "n/a" ? null : Number(score))

const latestOutputFor = (
  transcript: WorkflowTranscriptViewModel,
  variant: WorkflowTranscriptViewModel["entries"][number]["variant"]
): WorkflowRenderedPreviewOutput => {
  const preferred = transcript.entries.filter((entry) => entry.variant === variant && entry.nodeKind === "responder")
    .at(-1)

  return preferred ?? transcript.entries.filter((entry) => entry.variant === variant).at(-1) ?? null
}
