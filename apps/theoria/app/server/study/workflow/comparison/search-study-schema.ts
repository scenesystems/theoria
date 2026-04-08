import { Schema } from "effect"
import { Study } from "effect-search"
import * as SearchStudyEvent from "effect-search/StudyEvent"

import { WorkflowComparisonVariantExecution as WorkflowComparisonVariantExecutionSchema } from "../../../../contracts/study/workflow/comparison/run.js"
import { WorkflowComparisonSelectedKnobsSchema } from "./runtime-plan.js"

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))

export const WorkflowComparisonSearchEvaluationSchema = Schema.Struct({
  selection: WorkflowComparisonSelectedKnobsSchema,
  selectionKey: Schema.String,
  execution: WorkflowComparisonVariantExecutionSchema
})

export type WorkflowComparisonSearchEvaluation = Schema.Schema.Type<typeof WorkflowComparisonSearchEvaluationSchema>

export const WorkflowComparisonSearchStudyOutcomeSchema = Schema.Struct({
  trialBudget: NonNegativeInt,
  events: Schema.Array(SearchStudyEvent.StudyEventSchema),
  snapshot: Study.StudySnapshot,
  authored: WorkflowComparisonSearchEvaluationSchema,
  winner: WorkflowComparisonSearchEvaluationSchema
})

export type WorkflowComparisonSearchStudyOutcome = Schema.Schema.Type<typeof WorkflowComparisonSearchStudyOutcomeSchema>
