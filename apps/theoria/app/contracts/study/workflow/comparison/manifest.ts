import { Schema } from "effect"

export type WorkflowComparisonManifestSeed<Id extends string = string> = {
  readonly id: Id
  readonly label: string
  readonly summary: string
}

export const taskBriefingWorkflowComparisonId = "task-briefing"
export const chatHandoffWorkflowComparisonId = "chat-handoff"
export const retrievalRequiredWorkflowComparisonId = "retrieval-required"
export const renderSensitiveWorkflowComparisonId = "render-sensitive"

export const taskBriefingWorkflowComparisonManifest: WorkflowComparisonManifestSeed<
  typeof taskBriefingWorkflowComparisonId
> = {
  id: taskBriefingWorkflowComparisonId,
  label: "Task Briefing",
  summary:
    "Compares a baseline planning graph against an optimized task-first briefing flow under the same evaluation budget."
}

export const chatHandoffWorkflowComparisonManifest: WorkflowComparisonManifestSeed<
  typeof chatHandoffWorkflowComparisonId
> = {
  id: chatHandoffWorkflowComparisonId,
  label: "Chat Handoff",
  summary:
    "Compares a baseline conversation-handoff graph against an optimized multi-role continuation flow with the same runtime envelope."
}

export const retrievalRequiredWorkflowComparisonManifest: WorkflowComparisonManifestSeed<
  typeof retrievalRequiredWorkflowComparisonId
> = {
  id: retrievalRequiredWorkflowComparisonId,
  label: "Retrieval Required",
  summary:
    "Compares an ungrounded route summary against a retrieval-backed workflow that searches over evidence depth and bounded critique topology."
}

export const renderSensitiveWorkflowComparisonManifest: WorkflowComparisonManifestSeed<
  typeof renderSensitiveWorkflowComparisonId
> = {
  id: renderSensitiveWorkflowComparisonId,
  label: "Render Sensitive",
  summary:
    "Compares a surface-agnostic reply against a render-aware workflow that searches over critique depth, render checks, and surface policy."
}

export const workflowComparisonManifestCatalogSeed: ReadonlyArray<WorkflowComparisonManifestSeed> = [
  taskBriefingWorkflowComparisonManifest,
  chatHandoffWorkflowComparisonManifest,
  retrievalRequiredWorkflowComparisonManifest,
  renderSensitiveWorkflowComparisonManifest
]

export const workflowComparisonIdChoices: [
  typeof taskBriefingWorkflowComparisonId,
  typeof chatHandoffWorkflowComparisonId,
  typeof retrievalRequiredWorkflowComparisonId,
  typeof renderSensitiveWorkflowComparisonId
] = [
  taskBriefingWorkflowComparisonId,
  chatHandoffWorkflowComparisonId,
  retrievalRequiredWorkflowComparisonId,
  renderSensitiveWorkflowComparisonId
]

export const WorkflowComparisonIdSchema = Schema.Literal(...workflowComparisonIdChoices)

export type WorkflowComparisonId = Schema.Schema.Type<typeof WorkflowComparisonIdSchema>

export const workflowComparisonIds: ReadonlyArray<WorkflowComparisonId> = workflowComparisonIdChoices

export const defaultWorkflowComparisonId: WorkflowComparisonId = taskBriefingWorkflowComparisonManifest.id
