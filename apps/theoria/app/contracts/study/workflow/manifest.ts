import { Schema } from "effect"

export type WorkflowScenarioManifestSeed<Id extends string = string> = {
  readonly id: Id
  readonly label: string
  readonly summary: string
}

export const taskBriefingWorkflowScenarioId = "task-briefing"
export const chatHandoffWorkflowScenarioId = "chat-handoff"
export const retrievalRequiredWorkflowScenarioId = "retrieval-required"
export const renderSensitiveWorkflowScenarioId = "render-sensitive"

export const taskBriefingWorkflowScenarioManifest: WorkflowScenarioManifestSeed<
  typeof taskBriefingWorkflowScenarioId
> = {
  id: taskBriefingWorkflowScenarioId,
  label: "Task Briefing",
  summary:
    "Compares a baseline planning graph against an optimized task-first briefing flow under the same evaluation budget."
}

export const chatHandoffWorkflowScenarioManifest: WorkflowScenarioManifestSeed<
  typeof chatHandoffWorkflowScenarioId
> = {
  id: chatHandoffWorkflowScenarioId,
  label: "Chat Handoff",
  summary:
    "Compares a baseline conversation-handoff graph against an optimized multi-role continuation flow with the same runtime envelope."
}

export const retrievalRequiredWorkflowScenarioManifest: WorkflowScenarioManifestSeed<
  typeof retrievalRequiredWorkflowScenarioId
> = {
  id: retrievalRequiredWorkflowScenarioId,
  label: "Retrieval Required",
  summary:
    "Compares an ungrounded route summary against a retrieval-backed workflow that searches over evidence depth and bounded critique topology."
}

export const renderSensitiveWorkflowScenarioManifest: WorkflowScenarioManifestSeed<
  typeof renderSensitiveWorkflowScenarioId
> = {
  id: renderSensitiveWorkflowScenarioId,
  label: "Render Sensitive",
  summary:
    "Compares a surface-agnostic reply against a render-aware workflow that searches over critique depth, render checks, and surface policy."
}

export const workflowScenarioManifestCatalogSeed: ReadonlyArray<WorkflowScenarioManifestSeed> = [
  taskBriefingWorkflowScenarioManifest,
  chatHandoffWorkflowScenarioManifest,
  retrievalRequiredWorkflowScenarioManifest,
  renderSensitiveWorkflowScenarioManifest
]

export const workflowScenarioIdChoices: [
  typeof taskBriefingWorkflowScenarioId,
  typeof chatHandoffWorkflowScenarioId,
  typeof retrievalRequiredWorkflowScenarioId,
  typeof renderSensitiveWorkflowScenarioId
] = [
  taskBriefingWorkflowScenarioId,
  chatHandoffWorkflowScenarioId,
  retrievalRequiredWorkflowScenarioId,
  renderSensitiveWorkflowScenarioId
]

export const WorkflowScenarioIdSchema = Schema.Literal(...workflowScenarioIdChoices)

export type WorkflowScenarioId = Schema.Schema.Type<typeof WorkflowScenarioIdSchema>

export const workflowScenarioIds: ReadonlyArray<WorkflowScenarioId> = workflowScenarioIdChoices

export const defaultWorkflowScenarioId: WorkflowScenarioId = taskBriefingWorkflowScenarioManifest.id
