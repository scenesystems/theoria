import { Schema } from "effect"
import {
  ScoreProfileSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema
} from "effect-inference/Contracts"

export const makeWorkflowProfile = Schema.decodeUnknownSync(ScoreProfileSchema)

export const makeWorkflowExecutionRecord = Schema.decodeUnknownSync(WorkflowExecutionRecordSchema)

export const makeWorkflowEvaluationReport = Schema.decodeUnknownSync(WorkflowEvaluationReportSchema)
