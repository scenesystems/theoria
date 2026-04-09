import { Schema } from "effect"
import { Study } from "effect-search"
import * as SearchStudyEvent from "effect-search/StudyEvent"

import { WorkflowVariantExecution } from "../../../../contracts/study/workflow/execution.js"
import { WorkflowSelectedKnobs } from "../../../../contracts/study/workflow/runtime-plan.js"
import type { WorkflowSearchDimension } from "./dimensions.js"

const NonNegativeInt = Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
const StudyEventSchema: Schema.Schema<
  typeof SearchStudyEvent.StudyEventSchema.Type,
  SearchStudyEvent.StudyEventEncoded,
  typeof SearchStudyEvent.StudyEventSchema.Context
> = Schema.asSchema(SearchStudyEvent.StudyEventSchema)
const StudySnapshotSchema: Schema.Schema<
  typeof Study.StudySnapshot.Type,
  typeof Study.StudySnapshot.Encoded,
  typeof Study.StudySnapshot.Context
> = Schema.asSchema(Study.StudySnapshot)

export class WorkflowSearchEvaluation extends Schema.Class<WorkflowSearchEvaluation>(
  "WorkflowSearchEvaluation"
)({
  selection: WorkflowSelectedKnobs,
  selectionKey: Schema.String,
  execution: WorkflowVariantExecution
}) {}

export class WorkflowSearchStudyOutcome extends Schema.Class<WorkflowSearchStudyOutcome>(
  "WorkflowSearchStudyOutcome"
)({
  trialBudget: NonNegativeInt,
  events: Schema.Array(StudyEventSchema),
  snapshot: StudySnapshotSchema,
  authored: WorkflowSearchEvaluation,
  winner: WorkflowSearchEvaluation
}) {}

export type WorkflowSearchStudyResult = {
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly outcome: WorkflowSearchStudyOutcome
}
