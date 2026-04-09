import { Schema } from "effect"
import {
  ScoreProfileSchema,
  WorkflowEvaluationReportSchema,
  WorkflowExecutionRecordSchema
} from "effect-inference/Contracts"

import { WorkflowScenarioSchema } from "../../../contracts/study/workflow/scenario.js"

export const decodeWorkflowScenario = Schema.decodeUnknownSync(WorkflowScenarioSchema)

export const decodeWorkflowExecutionRecord = Schema.decodeUnknownSync(WorkflowExecutionRecordSchema)

export const decodeWorkflowEvaluationReport = Schema.decodeUnknownSync(WorkflowEvaluationReportSchema)

export const decodeWorkflowProfile = Schema.decodeUnknownSync(ScoreProfileSchema)
