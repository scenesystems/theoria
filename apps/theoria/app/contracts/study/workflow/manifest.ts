import { Schema } from "effect"
import { WorkflowSessionIdSchema } from "effect-inference/Contracts"

export const workflowStudyPathPrefix = "/studies/workflows"

export const WorkflowSeedIdSchema = WorkflowSessionIdSchema

export type WorkflowSeedId = Schema.Schema.Type<typeof WorkflowSeedIdSchema>

export const workflowStudyPath = (seedId: WorkflowSeedId): string => `${workflowStudyPathPrefix}/${seedId}`

export const isWorkflowSeedId = Schema.is(WorkflowSeedIdSchema)
