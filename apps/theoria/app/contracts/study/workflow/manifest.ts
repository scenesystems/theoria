import { Match, Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const taskBriefingWorkflowScenarioId = "task-briefing"
export const chatHandoffWorkflowScenarioId = "chat-handoff"
export const retrievalRequiredWorkflowScenarioId = "retrieval-required"
export const renderSensitiveWorkflowScenarioId = "render-sensitive"

const ids: readonly [
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

export const WorkflowScenarioIdSchema = Schema.Literal(...ids)

export type WorkflowScenarioId = Schema.Schema.Type<typeof WorkflowScenarioIdSchema>

export const defaultWorkflowScenarioId: WorkflowScenarioId = taskBriefingWorkflowScenarioId

export class WorkflowScenarioManifest extends Schema.Class<WorkflowScenarioManifest>("WorkflowScenarioManifest")({
  id: WorkflowScenarioIdSchema,
  label: NonEmptyString,
  summary: NonEmptyString
}) {
  static defaults(): WorkflowScenarioManifest {
    return byId[defaultWorkflowScenarioId]
  }

  static catalog(): ReadonlyArray<WorkflowScenarioManifest> {
    return ids.map((id) => byId[id])
  }

  static ids(): ReadonlyArray<WorkflowScenarioId> {
    return ids
  }

  static forId(id: WorkflowScenarioId): WorkflowScenarioManifest {
    return byId[id]
  }

  searchSeed(): number {
    return Match.value(this.id).pipe(
      Match.when(taskBriefingWorkflowScenarioId, () => 410),
      Match.when(chatHandoffWorkflowScenarioId, () => 411),
      Match.when(retrievalRequiredWorkflowScenarioId, () => 412),
      Match.when(renderSensitiveWorkflowScenarioId, () => 413),
      Match.exhaustive
    )
  }
}

const taskBriefingManifest = WorkflowScenarioManifest.make({
  id: taskBriefingWorkflowScenarioId,
  label: "Task Briefing",
  summary:
    "Compares a baseline planning graph against an optimized task-first briefing flow under the same evaluation budget."
})

const chatHandoffManifest = WorkflowScenarioManifest.make({
  id: chatHandoffWorkflowScenarioId,
  label: "Chat Handoff",
  summary:
    "Compares a baseline conversation-handoff graph against an optimized multi-role continuation flow with the same runtime envelope."
})

const retrievalRequiredManifest = WorkflowScenarioManifest.make({
  id: retrievalRequiredWorkflowScenarioId,
  label: "Retrieval Required",
  summary:
    "Compares an ungrounded route summary against a retrieval-backed workflow that searches over evidence depth and bounded critique topology."
})

const renderSensitiveManifest = WorkflowScenarioManifest.make({
  id: renderSensitiveWorkflowScenarioId,
  label: "Render Sensitive",
  summary:
    "Compares a surface-agnostic reply against a render-aware workflow that searches over critique depth, render checks, and surface policy."
})

const byId: Readonly<Record<WorkflowScenarioId, WorkflowScenarioManifest>> = {
  [taskBriefingWorkflowScenarioId]: taskBriefingManifest,
  [chatHandoffWorkflowScenarioId]: chatHandoffManifest,
  [retrievalRequiredWorkflowScenarioId]: retrievalRequiredManifest,
  [renderSensitiveWorkflowScenarioId]: renderSensitiveManifest
}
