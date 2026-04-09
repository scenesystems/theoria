import { Match, Schema } from "effect"

import { workflowOptimizeLabel, type WorkflowTargetMode, workflowTargetModeLabel } from "./controls.js"
import { workflowEvidenceItemLabels } from "./evidence.js"

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
    ? "Optimization is disabled for this frozen run plan, so the proving surface replays the authored optimized target without opening the study lane."
    : !hasProgress
    ? "The optimization study remains bounded by the frozen run plan and will stream trial progress, winner deltas, snapshot facts, and event trace evidence here."
    : targetMode === "authored-optimized"
    ? "The optimization study still runs and publishes a search winner, but the authored optimized replay remains the frozen target for this run."
    : "The search study is active on the same execution ledger, and the winning manifest remains the frozen replay target for the final pass."

export const workflowProgressMetricLabel = (metric: WorkflowProgressMetric): string =>
  Match.value(metric).pipe(
    Match.when("trial-budget", () => "Trial budget"),
    Match.when("completed-trials", () => "Completed trials"),
    Match.when("current-score", () => "Current score"),
    Match.when("best-score", () => "Best score"),
    Match.when("best-delta-vs-baseline", () => "Best delta vs baseline"),
    Match.when("best-delta-vs-authored-optimized", () => "Best delta vs authored optimized"),
    Match.exhaustive
  )

export const workflowProgressSelectionFieldLabel = (field: WorkflowProgressSelectionField): string =>
  Match.value(field).pipe(
    Match.when("optimization", () => "Optimization"),
    Match.when("replay-target", () => "Replay target"),
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
}): ReadonlyArray<ReadonlyArray<string>> => [
  [workflowProgressSelectionFieldLabel("optimization"), workflowOptimizeLabel(optimize)],
  [workflowProgressSelectionFieldLabel("replay-target"), workflowTargetModeLabel(targetMode)],
  [workflowEvidenceItemLabels.currentSelection, currentSelection ?? "n/a"],
  [workflowEvidenceItemLabels.bestSelection, bestSelection ?? "n/a"],
  [workflowEvidenceItemLabels.winnerRecord, winnerRecord ?? "n/a"]
]
