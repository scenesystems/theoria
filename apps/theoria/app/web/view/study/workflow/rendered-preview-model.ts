import { Match, Schema } from "effect"

import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import {
  workflowRenderedPreviewDescription,
  workflowRenderedPreviewFallback,
  workflowRenderedPreviewMetricLabel,
  workflowRenderedPreviewPaneLabel,
  workflowRenderedPreviewPaneNote
} from "../../../../contracts/study/workflow/surface-rendered-preview-presentation.js"
import {
  workflowDeltaText,
  WorkflowRenderedPreviewPaneKeySchema
} from "../../../../contracts/study/workflow/view-presentation.js"
import type { WorkflowGraphViewModel } from "./graph-model.js"
import type { WorkflowTranscriptViewModel } from "./transcript-model.js"

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
    readonly plan: WorkflowEntrySelection
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
