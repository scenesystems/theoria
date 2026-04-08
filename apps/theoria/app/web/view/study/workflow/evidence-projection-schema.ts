import { Schema } from "effect"
import { GraphVariantSchema, WorkflowNodeKindSchema } from "effect-inference/Contracts"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const NullableFiniteNumber = Schema.NullOr(Schema.Number.pipe(Schema.finite()))
const NullableString = Schema.NullOr(Schema.String)

export const WorkflowComparisonNumericComparisonProjection = Schema.Struct({
  baseline: NullableFiniteNumber,
  improved: NullableFiniteNumber
})

export type WorkflowComparisonNumericComparisonProjection = typeof WorkflowComparisonNumericComparisonProjection.Type

export const WorkflowComparisonVariantGraphProjection = Schema.Struct({
  traversal: Schema.Array(NonEmptyString),
  traversalSteps: NullableFiniteNumber
})

export type WorkflowComparisonVariantGraphProjection = typeof WorkflowComparisonVariantGraphProjection.Type

export const WorkflowComparisonOptimizationProgressProjection = Schema.Struct({
  bestScore: NullableFiniteNumber,
  bestSelection: NullableString,
  completedTrials: NullableFiniteNumber,
  currentScore: NullableFiniteNumber,
  currentSelection: NullableString,
  trialBudget: NullableFiniteNumber
})

export type WorkflowComparisonOptimizationProgressProjection =
  typeof WorkflowComparisonOptimizationProgressProjection.Type

export const WorkflowComparisonOptimizationSummaryProjection = Schema.Struct({
  completedTrials: NullableFiniteNumber,
  recoveredOrImprovedAuthoredOptimized: NullableString,
  trialBudget: NullableFiniteNumber,
  winnerVsAuthoredOptimizedNodeCount: WorkflowComparisonNumericComparisonProjection,
  winnerVsAuthoredOptimizedScore: WorkflowComparisonNumericComparisonProjection
})

export type WorkflowComparisonOptimizationSummaryProjection =
  typeof WorkflowComparisonOptimizationSummaryProjection.Type

export const WorkflowComparisonOptimizationWinnerProjection = Schema.Struct({
  selectedKnobs: Schema.Array(Schema.Tuple(NonEmptyString, NonEmptyString)),
  winnerRecord: NullableString,
  winnerTraversal: Schema.Array(NonEmptyString)
})

export type WorkflowComparisonOptimizationWinnerProjection = typeof WorkflowComparisonOptimizationWinnerProjection.Type

export const WorkflowComparisonOptimizationSnapshotProjection = Schema.Struct({
  facts: Schema.Array(Schema.Tuple(NonEmptyString, NonEmptyString)),
  snapshotJson: NullableString
})

export type WorkflowComparisonOptimizationSnapshotProjection =
  typeof WorkflowComparisonOptimizationSnapshotProjection.Type

export const WorkflowComparisonOptimizationStudyEventTraceProjection = Schema.Struct({
  rows: Schema.Array(Schema.Tuple(NonEmptyString, NonEmptyString, NonEmptyString))
})

export type WorkflowComparisonOptimizationStudyEventTraceProjection =
  typeof WorkflowComparisonOptimizationStudyEventTraceProjection.Type

export const WorkflowComparisonProjectedNodeExecution = Schema.Struct({
  durationMs: NullableFiniteNumber,
  key: NonEmptyString,
  nodeId: NonEmptyString,
  nodeKind: WorkflowNodeKindSchema,
  output: NullableString,
  prompt: NullableString,
  rawResponse: NullableString,
  totalTokens: NullableFiniteNumber,
  variant: GraphVariantSchema
})

export type WorkflowComparisonProjectedNodeExecution = typeof WorkflowComparisonProjectedNodeExecution.Type

export const WorkflowComparisonEvidenceProjection = Schema.Struct({
  comparisonDelta: Schema.Struct({
    aggregateScore: WorkflowComparisonNumericComparisonProjection,
    graphNodes: WorkflowComparisonNumericComparisonProjection
  }),
  graphs: Schema.Struct({
    baseline: WorkflowComparisonVariantGraphProjection,
    optimized: WorkflowComparisonVariantGraphProjection
  }),
  nodeExecutions: Schema.Array(WorkflowComparisonProjectedNodeExecution),
  optimizationProgress: Schema.NullOr(WorkflowComparisonOptimizationProgressProjection),
  optimizationSnapshot: Schema.NullOr(WorkflowComparisonOptimizationSnapshotProjection),
  optimizationStudyEventTrace: Schema.NullOr(WorkflowComparisonOptimizationStudyEventTraceProjection),
  optimizationSummary: Schema.NullOr(WorkflowComparisonOptimizationSummaryProjection),
  optimizationWinner: Schema.NullOr(WorkflowComparisonOptimizationWinnerProjection)
})

export type WorkflowComparisonEvidenceProjection = typeof WorkflowComparisonEvidenceProjection.Type
