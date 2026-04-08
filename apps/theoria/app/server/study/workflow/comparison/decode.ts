import { Schema } from "effect"
import {
  ScoreProfileSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema
} from "effect-inference/Contracts"

import { WorkflowComparisonSchema } from "../../../../contracts/study/workflow/comparison/comparison.js"

export const makeWorkflowComparison = Schema.decodeUnknownSync(WorkflowComparisonSchema)

export const makeWorkflowExecutionRecord = Schema.decodeUnknownSync(WorkflowExecutionRecordSchema)

export const makeWorkflowEvaluationReport = Schema.decodeUnknownSync(WorkflowEvaluationReportSchema)

export const makeWorkflowProfile = Schema.decodeUnknownSync(ScoreProfileSchema)
