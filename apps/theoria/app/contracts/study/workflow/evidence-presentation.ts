import { Match, Option } from "effect"
import type { GraphVariant } from "effect-inference/Contracts"

import type { WorkflowNodeExecution } from "./execution.js"

export const workflowEvidenceSectionTitles = {
  optimizationSnapshot: "Optimization Snapshot",
  optimizationStudyEventTrace: "Optimization Study Event Trace",
  optimizationStudyProgress: "Optimization Study Progress",
  optimizationStudySummary: "Optimization Study Summary",
  optimizationWinner: "Optimization Winner"
}

export const workflowEvidenceItemLabels = {
  aggregateScore: "Aggregate Score",
  bestScore: "Best score",
  bestSelection: "Best selection",
  completedTrials: "Completed trials",
  currentScore: "Current score",
  currentSelection: "Current selection",
  graphNodes: "Graph Nodes",
  output: "Output",
  prompt: "Prompt",
  rawResponse: "Raw response",
  recoveredOrImprovedAuthoredOptimized: "Recovered or improved authored optimized",
  runtimeEvidence: "Runtime Evidence",
  selectedKnobs: "Selected knobs",
  snapshotFacts: "Snapshot facts",
  snapshotJson: "Snapshot JSON",
  studyEvents: "Study events",
  summary: "Summary",
  totalTokens: "Total tokens",
  traceDuration: "Trace duration",
  traversal: "Traversal",
  traversalSteps: "Traversal Steps",
  trialBudget: "Trial budget",
  workflow: "Workflow",
  winnerRecord: "Winner record",
  winnerTraversal: "Winner traversal",
  winnerVsAuthoredOptimizedNodeCount: "Winner vs authored optimized node count",
  winnerVsAuthoredOptimizedScore: "Winner vs authored optimized score"
}

export const workflowRuntimeEvidenceFieldLabels = {
  completedAt: "Completed at",
  requestedModel: "Requested model",
  responseId: "Response id",
  responseModel: "Response model",
  routeFamily: "Route family",
  selectedProvider: "Selected provider",
  serveMode: "Serve mode",
  startedAt: "Started at"
}

export const workflowGraphVariantLabel = (variant: GraphVariant): string =>
  Match.value(variant).pipe(
    Match.when("baseline", () => "Baseline"),
    Match.when("optimized", () => "Optimized"),
    Match.exhaustive
  )

export const workflowTranscriptDescriptions = {
  empty: "Transcript evidence appears here once baseline and winner node sections land on the shared ledger.",
  present: "Every transcript row is projected from package-authored node evidence, not browser-local replay logic."
}

export const workflowEvidenceTableColumns = {
  nodeExecutionTranscript: ["Evidence", "Node", "Prompt", "Output", "Tokens", "Duration"],
  optimizationSnapshot: ["Field", "Value"],
  optimizationStudyEventTrace: ["#", "Event", "Detail"],
  optimizationWinner: ["Knob", "Choice"],
  runtimeEvidence: ["Field", "Value"],
  variantTraversal: ["Node", "Kind", "Role"]
}

const optionalWorkflowRuntimeField = (value: string | number | null): string =>
  Option.fromNullable(value).pipe(
    Option.match({
      onNone: () => "n/a",
      onSome: (resolved) => `${resolved}`
    })
  )

export const workflowNodeExecutionLatencyMs = (execution: WorkflowNodeExecution): number =>
  Option.all({
    startedAt: Option.fromNullable(execution.runtimeEvidence.resolvedRuntime.startedAtMs),
    completedAt: Option.fromNullable(execution.runtimeEvidence.resolvedRuntime.completedAtMs)
  }).pipe(
    Option.match({
      onNone: () => execution.trace.durationMs,
      onSome: ({ completedAt, startedAt }) => Math.max(completedAt - startedAt, 0)
    })
  )

export const workflowNodeExecutionTotalTokens = (execution: WorkflowNodeExecution): number =>
  execution.runtimeEvidence.resolvedRuntime.usage?.totalTokens ?? execution.trace.totalTokens

export const workflowRuntimeEvidenceRows = (
  execution: WorkflowNodeExecution
): ReadonlyArray<readonly [string, string]> => [
  [workflowRuntimeEvidenceFieldLabels.requestedModel, execution.runtimeEvidence.desired.artifact.modelRef],
  [workflowRuntimeEvidenceFieldLabels.routeFamily, execution.runtimeEvidence.resolvedRoute.route.family],
  [workflowRuntimeEvidenceFieldLabels.serveMode, execution.runtimeEvidence.resolvedRoute.route.serveMode],
  [
    workflowRuntimeEvidenceFieldLabels.selectedProvider,
    optionalWorkflowRuntimeField(execution.runtimeEvidence.resolvedRoute.selectedProvider ?? null)
  ],
  [workflowRuntimeEvidenceFieldLabels.responseModel, execution.runtimeEvidence.resolvedRuntime.responseModel],
  [
    workflowRuntimeEvidenceFieldLabels.responseId,
    optionalWorkflowRuntimeField(execution.runtimeEvidence.resolvedRuntime.responseId ?? null)
  ],
  [
    workflowRuntimeEvidenceFieldLabels.startedAt,
    optionalWorkflowRuntimeField(execution.runtimeEvidence.resolvedRuntime.startedAtMs ?? null)
  ],
  [
    workflowRuntimeEvidenceFieldLabels.completedAt,
    optionalWorkflowRuntimeField(execution.runtimeEvidence.resolvedRuntime.completedAtMs ?? null)
  ]
]

export const workflowOptimizationSnapshotFacts = ({
  completedCount,
  nextTrialNumber,
  samplerKind,
  snapshotFormatVersion,
  spaceFingerprint,
  studyDuration,
  trialCount,
  workflowSeedId
}: {
  readonly completedCount: number
  readonly nextTrialNumber: number
  readonly samplerKind: string
  readonly snapshotFormatVersion: number
  readonly spaceFingerprint: string
  readonly studyDuration: number
  readonly trialCount: number
  readonly workflowSeedId: string
}): ReadonlyArray<ReadonlyArray<string>> => [
  ["workflow seed", workflowSeedId],
  ["snapshot format", `${snapshotFormatVersion}`],
  ["next trial number", `${nextTrialNumber}`],
  ["completed count", `${completedCount}`],
  ["trial count", `${trialCount}`],
  ["study duration", `${studyDuration}`],
  ["sampler kind", samplerKind],
  ["space fingerprint", spaceFingerprint]
]
