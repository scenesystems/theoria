import { Schema } from "effect"
import { GraphVariantSchema, WorkflowNodeKindSchema } from "effect-inference/Contracts"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const NullableFiniteNumber = Schema.NullOr(Schema.Number.pipe(Schema.finite()))
const NullableString = Schema.NullOr(Schema.String)

export const WorkflowNumericComparisonProjection = Schema.Struct({
  baseline: NullableFiniteNumber,
  improved: NullableFiniteNumber
})

export type WorkflowNumericComparisonProjection = typeof WorkflowNumericComparisonProjection.Type

export const WorkflowVariantGraphProjection = Schema.Struct({
  title: NonEmptyString,
  traversal: Schema.Array(NonEmptyString),
  traversalSteps: NullableFiniteNumber
})

export type WorkflowVariantGraphProjection = typeof WorkflowVariantGraphProjection.Type

export const WorkflowOptimizationProgressProjection = Schema.Struct({
  bestScore: NullableFiniteNumber,
  bestSelection: NullableString,
  completedTrials: NullableFiniteNumber,
  currentScore: NullableFiniteNumber,
  currentSelection: NullableString,
  trialBudget: NullableFiniteNumber
})

export type WorkflowOptimizationProgressProjection = typeof WorkflowOptimizationProgressProjection.Type

export const WorkflowOptimizationSummaryProjection = Schema.Struct({
  completedTrials: NullableFiniteNumber,
  recoveredOrImprovedAuthoredOptimized: NullableString,
  trialBudget: NullableFiniteNumber,
  winnerVsAuthoredOptimizedNodeCount: WorkflowNumericComparisonProjection,
  winnerVsAuthoredOptimizedScore: WorkflowNumericComparisonProjection
})

export type WorkflowOptimizationSummaryProjection = typeof WorkflowOptimizationSummaryProjection.Type

export const WorkflowOptimizationWinnerProjection = Schema.Struct({
  selectedKnobs: Schema.Array(Schema.Tuple(NonEmptyString, NonEmptyString)),
  winnerRecord: NullableString,
  winnerTraversal: Schema.Array(NonEmptyString)
})

export type WorkflowOptimizationWinnerProjection = typeof WorkflowOptimizationWinnerProjection.Type

export const WorkflowOptimizationSnapshotProjection = Schema.Struct({
  facts: Schema.Array(Schema.Tuple(NonEmptyString, NonEmptyString)),
  snapshotJson: NullableString
})

export type WorkflowOptimizationSnapshotProjection = typeof WorkflowOptimizationSnapshotProjection.Type

export const WorkflowOptimizationStudyEventTraceProjection = Schema.Struct({
  rows: Schema.Array(Schema.Tuple(NonEmptyString, NonEmptyString, NonEmptyString))
})

export type WorkflowOptimizationStudyEventTraceProjection = typeof WorkflowOptimizationStudyEventTraceProjection.Type

export const WorkflowProjectedNodeExecution = Schema.Struct({
  durationMs: NullableFiniteNumber,
  key: NonEmptyString,
  nodeId: NonEmptyString,
  nodeKind: WorkflowNodeKindSchema,
  output: NullableString,
  prompt: NullableString,
  rawResponse: NullableString,
  totalTokens: NullableFiniteNumber,
  title: NonEmptyString,
  variant: GraphVariantSchema
})

export type WorkflowProjectedNodeExecution = typeof WorkflowProjectedNodeExecution.Type
