import type { WorkflowComparisonNodeExecution } from "./run.js"

export const workflowComparisonEvidenceSectionKeys = {
  comparisonDelta: "workflow-comparison/comparison-delta",
  optimizationStudyEventTrace: "workflow-comparison/optimization-study-event-trace",
  optimizationStudyProgress: "workflow-comparison/optimization-study-progress",
  optimizationStudySummary: "workflow-comparison/optimization-study-summary",
  optimizationSnapshot: "workflow-comparison/optimization-snapshot",
  optimizationWinner: "workflow-comparison/optimization-winner",
  overview: "workflow-comparison/overview",
  variantOverviewPrefix: "workflow-comparison/variant-overview"
}

export const workflowComparisonEvidenceItemKeys = {
  aggregateScore: "workflow-comparison/aggregate-score",
  bestScore: "workflow-comparison/best-score",
  bestSelection: "workflow-comparison/best-selection",
  completedTrials: "workflow-comparison/completed-trials",
  currentScore: "workflow-comparison/current-score",
  currentSelection: "workflow-comparison/current-selection",
  graphNodes: "workflow-comparison/graph-nodes",
  output: "workflow-comparison/output",
  prompt: "workflow-comparison/prompt",
  rawResponse: "workflow-comparison/raw-response",
  recoveredOrImprovedAuthoredOptimized: "workflow-comparison/recovered-or-improved-authored-optimized",
  selectedKnobs: "workflow-comparison/selected-knobs",
  snapshotFacts: "workflow-comparison/snapshot-facts",
  snapshotJson: "workflow-comparison/snapshot-json",
  studyEvents: "workflow-comparison/study-events",
  totalTokens: "workflow-comparison/total-tokens",
  traceDuration: "workflow-comparison/trace-duration-ms",
  traversal: "workflow-comparison/traversal",
  traversalSteps: "workflow-comparison/traversal-steps",
  trialBudget: "workflow-comparison/trial-budget",
  winnerRecord: "workflow-comparison/winner-record",
  winnerTraversal: "workflow-comparison/winner-traversal",
  winnerVsAuthoredOptimizedNodeCount: "workflow-comparison/winner-vs-authored-optimized-node-count",
  winnerVsAuthoredOptimizedScore: "workflow-comparison/winner-vs-authored-optimized-score"
}

export const workflowComparisonNodeExecutionSectionPrefix = "workflow-comparison/node-execution"

type WorkflowComparisonNodeKind = WorkflowComparisonNodeExecution["node"]["nodeKind"]
type WorkflowComparisonVariant = WorkflowComparisonNodeExecution["variant"]

export const workflowComparisonVariantOverviewSectionKey = (variant: WorkflowComparisonVariant): string =>
  `${workflowComparisonEvidenceSectionKeys.variantOverviewPrefix}/${variant}`

export const workflowComparisonNodeExecutionSectionKey = ({
  nodeId,
  nodeKind,
  variant
}: {
  readonly nodeId: string
  readonly nodeKind: WorkflowComparisonNodeKind
  readonly variant: WorkflowComparisonVariant
}): string => `${workflowComparisonNodeExecutionSectionPrefix}/${variant}/${nodeId}/${nodeKind}`
