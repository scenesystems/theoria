import { Match, Schema } from "effect"
import { PresentationDetailRow, presentationDetailRow } from "../../presentation/detail-row.js"

import { workflowOptimizeLabel, type WorkflowTargetMode, workflowTargetModeLabel } from "./controls.js"
import { workflowEvidenceItemLabels, workflowTableDetailRows } from "./evidence.js"

export type WorkflowProgressMetric =
  | "best-delta-vs-authored-optimized"
  | "best-delta-vs-baseline"
  | "best-score"
  | "completed-trials"
  | "current-score"
  | "trial-budget"

export type WorkflowProgressSelectionField = "optimization" | "replay-target"

export class WorkflowProgressMetricPresentation extends Schema.Class<WorkflowProgressMetricPresentation>(
  "WorkflowProgressMetricPresentation"
)({
  label: Schema.String,
  value: Schema.String
}) {}

export const workflowProgressDescription = ({
  hasProgress,
  optimize,
  targetMode
}: {
  readonly hasProgress: boolean
  readonly optimize: boolean
  readonly targetMode: WorkflowTargetMode
}): string =>
  !optimize
    ? "This run is replay-only, so you will compare the baseline with the authored improvement without opening the search loop."
    : !hasProgress
    ? "Start the study to track trials, score changes, snapshots, and the emerging winner here."
    : targetMode === "authored-optimized"
    ? "Search is running in the background, but this run will still finish by replaying the authored improvement."
    : "Search is active, and the final replay will follow the best workflow found so far."

export const workflowProgressMetricLabel = (metric: WorkflowProgressMetric): string =>
  Match.value(metric).pipe(
    Match.when("trial-budget", () => "Trial budget"),
    Match.when("completed-trials", () => "Completed trials"),
    Match.when("current-score", () => "Current score"),
    Match.when("best-score", () => "Best score"),
    Match.when("best-delta-vs-baseline", () => "Best lift vs baseline"),
    Match.when("best-delta-vs-authored-optimized", () => "Best lift vs authored improvement"),
    Match.exhaustive
  )

export const workflowProgressSelectionFieldLabel = (field: WorkflowProgressSelectionField): string =>
  Match.value(field).pipe(
    Match.when("optimization", () => "Search mode"),
    Match.when("replay-target", () => "Final replay"),
    Match.exhaustive
  )

export const workflowProgressMetricValue = ({
  digits = 0,
  value
}: {
  readonly digits?: number
  readonly value: number | null
}): string => value === null ? "n/a" : digits === 0 ? `${value}` : value.toFixed(digits)

export const workflowProgressDeltaValue = ({
  baseline,
  improved
}: {
  readonly baseline: number | null
  readonly improved: number | null
}): string =>
  baseline === null || improved === null
    ? "n/a"
    : `${improved >= baseline ? "+" : ""}${(improved - baseline).toFixed(3)}`

export const workflowProgressMetricRows = ({
  authoredOptimizedScore,
  baselineScore,
  bestScore,
  completedTrials,
  currentScore,
  trialBudget
}: {
  readonly authoredOptimizedScore: number | null
  readonly baselineScore: number | null
  readonly bestScore: number | null
  readonly completedTrials: number | null
  readonly currentScore: number | null
  readonly trialBudget: number | null
}): ReadonlyArray<WorkflowProgressMetricPresentation> => [
  WorkflowProgressMetricPresentation.make({
    label: workflowProgressMetricLabel("trial-budget"),
    value: workflowProgressMetricValue({ value: trialBudget })
  }),
  WorkflowProgressMetricPresentation.make({
    label: workflowProgressMetricLabel("completed-trials"),
    value: workflowProgressMetricValue({ value: completedTrials })
  }),
  WorkflowProgressMetricPresentation.make({
    label: workflowProgressMetricLabel("current-score"),
    value: workflowProgressMetricValue({ digits: 3, value: currentScore })
  }),
  WorkflowProgressMetricPresentation.make({
    label: workflowProgressMetricLabel("best-score"),
    value: workflowProgressMetricValue({ digits: 3, value: bestScore })
  }),
  WorkflowProgressMetricPresentation.make({
    label: workflowProgressMetricLabel("best-delta-vs-baseline"),
    value: workflowProgressDeltaValue({ baseline: baselineScore, improved: bestScore })
  }),
  WorkflowProgressMetricPresentation.make({
    label: workflowProgressMetricLabel("best-delta-vs-authored-optimized"),
    value: workflowProgressDeltaValue({ baseline: authoredOptimizedScore, improved: bestScore })
  })
]

export const workflowProgressSelectionRows = ({
  bestSelection,
  currentSelection,
  optimize,
  targetMode,
  winnerRecord
}: {
  readonly bestSelection: string | null
  readonly currentSelection: string | null
  readonly optimize: boolean
  readonly targetMode: WorkflowTargetMode
  readonly winnerRecord: string | null
}): ReadonlyArray<PresentationDetailRow> => [
  presentationDetailRow(workflowProgressSelectionFieldLabel("optimization"), workflowOptimizeLabel(optimize)),
  presentationDetailRow(workflowProgressSelectionFieldLabel("replay-target"), workflowTargetModeLabel(targetMode)),
  presentationDetailRow(workflowEvidenceItemLabels.currentSelection, currentSelection ?? "n/a"),
  presentationDetailRow(workflowEvidenceItemLabels.bestSelection, bestSelection ?? "n/a"),
  presentationDetailRow(workflowEvidenceItemLabels.winnerRecord, winnerRecord ?? "n/a")
]

const StringRows = Schema.Array(Schema.Array(Schema.String))

type WorkflowOptimizationProgressEvidence = {
  readonly bestScore: number | null
  readonly bestSelection: string | null
  readonly completedTrials: number | null
  readonly currentScore: number | null
  readonly currentSelection: string | null
  readonly trialBudget: number | null
} | null

type WorkflowOptimizationSnapshotEvidence = {
  readonly facts: ReadonlyArray<ReadonlyArray<string>>
} | null

type WorkflowOptimizationSummaryEvidence = {
  readonly completedTrials: number | null
  readonly trialBudget: number | null
  readonly winnerVsAuthoredOptimizedScore: {
    readonly baseline: number | null
    readonly improved: number | null
  }
} | null

type WorkflowOptimizationWinnerEvidence = {
  readonly winnerRecord: string | null
} | null

type WorkflowStudyEventTraceEvidence = {
  readonly rows: ReadonlyArray<ReadonlyArray<string>>
} | null

export type WorkflowProgressEvidenceProjection = {
  readonly workflowDelta: {
    readonly aggregateScore: {
      readonly baseline: number | null
    }
  }
  readonly optimizationProgress: WorkflowOptimizationProgressEvidence
  readonly optimizationSnapshot: WorkflowOptimizationSnapshotEvidence
  readonly optimizationStudyEventTrace: WorkflowStudyEventTraceEvidence
  readonly optimizationSummary: WorkflowOptimizationSummaryEvidence
  readonly optimizationWinner: WorkflowOptimizationWinnerEvidence
}

export class WorkflowProgressViewModel extends Schema.Class<WorkflowProgressViewModel>("WorkflowProgressViewModel")({
  description: Schema.String,
  eventRows: StringRows,
  metrics: Schema.Array(WorkflowProgressMetricPresentation),
  selectionRows: Schema.Array(PresentationDetailRow),
  snapshotRows: Schema.Array(PresentationDetailRow)
}) {
  static project({
    evidence,
    plan
  }: {
    readonly evidence: WorkflowProgressEvidenceProjection
    readonly plan: {
      readonly controls: {
        readonly optimize: boolean
        readonly targetMode: WorkflowTargetMode
      }
    }
  }): WorkflowProgressViewModel {
    const baselineScore = evidence.workflowDelta.aggregateScore.baseline
    const authoredOptimizedScore = evidence.optimizationSummary?.winnerVsAuthoredOptimizedScore.baseline ?? null
    const bestScore = evidence.optimizationSummary?.winnerVsAuthoredOptimizedScore.improved
      ?? evidence.optimizationProgress?.bestScore
      ?? null
    const currentScore = evidence.optimizationProgress?.currentScore ?? null
    const completedTrials = evidence.optimizationProgress?.completedTrials
      ?? evidence.optimizationSummary?.completedTrials
      ?? null
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
      }),
      selectionRows: workflowProgressSelectionRows({
        bestSelection: evidence.optimizationProgress?.bestSelection ?? null,
        currentSelection: evidence.optimizationProgress?.currentSelection ?? null,
        optimize: plan.controls.optimize,
        targetMode: plan.controls.targetMode,
        winnerRecord: evidence.optimizationWinner?.winnerRecord ?? null
      }),
      snapshotRows: workflowTableDetailRows(evidence.optimizationSnapshot?.facts ?? [])
    })
  }
}
