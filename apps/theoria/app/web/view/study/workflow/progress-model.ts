import { Schema } from "effect"

import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import {
  workflowProgressDescription,
  workflowProgressMetricRows,
  workflowProgressSelectionRows
} from "../../../../contracts/study/workflow/surface-progress-presentation.js"

import type { WorkflowEvidenceProjection } from "../../../state/workflow/workflow-evidence.js"

const StringRows = Schema.Array(Schema.Array(Schema.String))

export class WorkflowProgressMetricViewModel extends Schema.Class<WorkflowProgressMetricViewModel>(
  "WorkflowProgressMetricViewModel"
)({
  label: Schema.String,
  value: Schema.String
}) {}

export class WorkflowProgressViewModel extends Schema.Class<WorkflowProgressViewModel>(
  "WorkflowProgressViewModel"
)({
  description: Schema.String,
  eventRows: StringRows,
  metrics: Schema.Array(WorkflowProgressMetricViewModel),
  selectionRows: StringRows,
  snapshotRows: StringRows
}) {
  static project({
    evidence,
    plan
  }: {
    readonly evidence: WorkflowEvidenceProjection
    readonly plan: WorkflowEntrySelection
  }): WorkflowProgressViewModel {
    const baselineScore = evidence.workflowDelta.aggregateScore.baseline
    const authoredOptimizedScore = evidence.optimizationSummary?.winnerVsAuthoredOptimizedScore.baseline ?? null
    const bestScore = evidence.optimizationSummary?.winnerVsAuthoredOptimizedScore.improved
      ?? evidence.optimizationProgress?.bestScore
      ?? null
    const currentScore = evidence.optimizationProgress?.currentScore ?? null
    const completedTrials = evidence.optimizationProgress?.completedTrials ??
      evidence.optimizationSummary?.completedTrials ?? null
    const trialBudget = evidence.optimizationProgress?.trialBudget ?? evidence.optimizationSummary?.trialBudget ?? null

    return WorkflowProgressViewModel.make({
      description: workflowProgressDescription({
        hasProgress: evidence.optimizationProgress !== null || evidence.optimizationSummary !== null,
        optimize: plan.controls.optimize,
        targetMode: plan.controls.targetMode
      }),
      eventRows: evidence.optimizationStudyEventTrace?.rows ?? [],
      metrics: workflowProgressMetricRows({
        authoredOptimizedScore,
        baselineScore,
        bestScore,
        completedTrials,
        currentScore,
        trialBudget
      }).map(({ label, value }) => WorkflowProgressMetricViewModel.make({ label, value })),
      selectionRows: workflowProgressSelectionRows({
        bestSelection: evidence.optimizationProgress?.bestSelection ?? null,
        currentSelection: evidence.optimizationProgress?.currentSelection ?? null,
        optimize: plan.controls.optimize,
        targetMode: plan.controls.targetMode,
        winnerRecord: evidence.optimizationWinner?.winnerRecord ?? null
      }),
      snapshotRows: evidence.optimizationSnapshot?.facts ?? []
    })
  }
}
