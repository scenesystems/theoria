import { Schema } from "effect"

export const WorkflowStudyId = Schema.Literal("workflow")

export type WorkflowStudyId = typeof WorkflowStudyId.Type

export const workflowStudyId: WorkflowStudyId = "workflow"

export const StudyId = WorkflowStudyId

export type StudyId = typeof StudyId.Type

export const studyIds: ReadonlyArray<StudyId> = [workflowStudyId]

export const isStudyId = Schema.is(StudyId)
export const isWorkflowStudyId = Schema.is(WorkflowStudyId)
