import type { EvidenceSection } from "../../../contracts/evidence.js"
import type { WorkflowComparisonRunPlan } from "../../../contracts/workflow/comparison-run.js"
import {
  workflowComparisonComparisonModeLabel,
  workflowComparisonOptimizeLabel
} from "../../../contracts/workflow/comparison-run.js"

import { workflowComparisonEvidenceProjectionFromSections } from "./workflow-comparison-evidence-projection.js"

export type WorkflowComparisonProgressMetricViewModel = {
  readonly label: string
  readonly value: string
}

export type WorkflowComparisonProgressViewModel = {
  readonly description: string
  readonly eventRows: ReadonlyArray<ReadonlyArray<string>>
  readonly metrics: ReadonlyArray<WorkflowComparisonProgressMetricViewModel>
  readonly selectionRows: ReadonlyArray<ReadonlyArray<string>>
  readonly snapshotRows: ReadonlyArray<ReadonlyArray<string>>
}

const formatNumber = (value: number | null, digits = 0): string =>
  value === null ? "n/a" : digits === 0 ? `${value}` : value.toFixed(digits)

const formatDelta = (baseline: number | null, improved: number | null): string =>
  baseline === null || improved === null
    ? "n/a"
    : `${improved >= baseline ? "+" : ""}${(improved - baseline).toFixed(3)}`

export const workflowComparisonProgressViewModel = ({
  plan,
  sections
}: {
  readonly plan: WorkflowComparisonRunPlan
  readonly sections: ReadonlyArray<EvidenceSection>
}): WorkflowComparisonProgressViewModel => {
  const projection = workflowComparisonEvidenceProjectionFromSections(sections)
  const baselineScore = projection.comparisonDelta.aggregateScore.baseline
  const authoredOptimizedScore = projection.optimizationSummary?.winnerVsAuthoredOptimizedScore.baseline ?? null
  const bestScore = projection.optimizationSummary?.winnerVsAuthoredOptimizedScore.improved
    ?? projection.optimizationProgress?.bestScore
    ?? null
  const currentScore = projection.optimizationProgress?.currentScore ?? null

  return {
    description: !plan.optimize
      ? "Optimization is disabled for this frozen run plan, so the proving surface replays the authored optimized comparison target without opening the study lane."
      : projection.optimizationProgress === null && projection.optimizationSummary === null
      ? "The optimization study remains bounded by the frozen run plan and will stream trial progress, winner deltas, snapshot facts, and event trace evidence here."
      : plan.comparisonMode === "authored-optimized"
      ? "The optimization study still runs and publishes a search winner, but the authored optimized replay remains the frozen comparison target for this run."
      : "The search study is active on the same execution ledger, and the winning manifest remains the frozen comparison target for the final replay.",
    eventRows: projection.optimizationStudyEventTrace?.rows ?? [],
    metrics: [
      {
        label: "Trial budget",
        value: formatNumber(
          projection.optimizationProgress?.trialBudget ?? projection.optimizationSummary?.trialBudget ?? null
        )
      },
      {
        label: "Completed trials",
        value: formatNumber(
          projection.optimizationProgress?.completedTrials ?? projection.optimizationSummary?.completedTrials ?? null
        )
      },
      { label: "Current score", value: formatNumber(currentScore, 3) },
      { label: "Best score", value: formatNumber(bestScore, 3) },
      {
        label: "Best delta vs baseline",
        value: formatDelta(baselineScore, bestScore)
      },
      {
        label: "Best delta vs authored optimized",
        value: formatDelta(authoredOptimizedScore, bestScore)
      }
    ],
    selectionRows: [
      ["Optimization", workflowComparisonOptimizeLabel(plan.optimize)],
      ["Comparison target", workflowComparisonComparisonModeLabel(plan.comparisonMode)],
      ["Current selection", projection.optimizationProgress?.currentSelection ?? "n/a"],
      ["Best selection", projection.optimizationProgress?.bestSelection ?? "n/a"],
      ["Winner record", projection.optimizationWinner?.winnerRecord ?? "n/a"]
    ],
    snapshotRows: projection.optimizationSnapshot?.facts ?? []
  }
}
