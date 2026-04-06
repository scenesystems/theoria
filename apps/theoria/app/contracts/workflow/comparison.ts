import { Schema } from "effect"
import {
  ScoreProfileSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema,
  WorkflowKindSchema
} from "effect-inference/Contracts"

import { Id } from "../id.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const WorkflowComparisonIdSchema = Id

export type WorkflowComparisonId = Schema.Schema.Type<typeof WorkflowComparisonIdSchema>

export const WorkflowExecutionRecordPairSchema = Schema.Struct({
  baseline: WorkflowExecutionRecordSchema,
  optimized: WorkflowExecutionRecordSchema
})

export type WorkflowExecutionRecordPair = Schema.Schema.Type<typeof WorkflowExecutionRecordPairSchema>

export const WorkflowEvaluationReportPairSchema = Schema.Struct({
  baseline: WorkflowEvaluationReportSchema,
  optimized: WorkflowEvaluationReportSchema
})

export type WorkflowEvaluationReportPair = Schema.Schema.Type<typeof WorkflowEvaluationReportPairSchema>

export const WorkflowProfileLibrarySchema = Schema.Struct({
  taskOriented: ScoreProfileSchema,
  chatOriented: ScoreProfileSchema,
  retrievalOriented: ScoreProfileSchema,
  renderSensitive: ScoreProfileSchema
})

export type WorkflowProfileLibrary = Schema.Schema.Type<typeof WorkflowProfileLibrarySchema>

export const WorkflowComparisonSchema = Schema.Struct({
  id: WorkflowComparisonIdSchema,
  label: NonEmptyString,
  summary: NonEmptyString,
  workflowKind: WorkflowKindSchema,
  records: WorkflowExecutionRecordPairSchema,
  reports: WorkflowEvaluationReportPairSchema
})

export type WorkflowComparison = Schema.Schema.Type<typeof WorkflowComparisonSchema>

export const WorkflowComparisonCatalogSchema = Schema.Array(WorkflowComparisonSchema)

export type WorkflowComparisonCatalog = Schema.Schema.Type<typeof WorkflowComparisonCatalogSchema>
