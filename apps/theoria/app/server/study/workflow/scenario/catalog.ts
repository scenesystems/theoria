import * as Arr from "effect/Array"

import {
  chatHandoffWorkflowScenarioId,
  renderSensitiveWorkflowScenarioId,
  retrievalRequiredWorkflowScenarioId,
  taskBriefingWorkflowScenarioId
} from "../../../../contracts/study/workflow/manifest.js"
import type { WorkflowScenario } from "../../../../contracts/study/workflow/scenario.js"
import { type WorkflowScenarioCatalog, type WorkflowScenarioId } from "../../../../contracts/study/workflow/scenario.js"
import { chatHandoffWorkflowScenario } from "./chat-handoff.js"
import { renderSensitiveWorkflowScenario } from "./render-sensitive.js"
import { retrievalRequiredWorkflowScenario } from "./retrieval-required.js"
import { taskBriefingWorkflowScenario } from "./task-briefing.js"

const byId: Readonly<Record<WorkflowScenarioId, WorkflowScenario>> = {
  [taskBriefingWorkflowScenarioId]: taskBriefingWorkflowScenario,
  [chatHandoffWorkflowScenarioId]: chatHandoffWorkflowScenario,
  [retrievalRequiredWorkflowScenarioId]: retrievalRequiredWorkflowScenario,
  [renderSensitiveWorkflowScenarioId]: renderSensitiveWorkflowScenario
}

export const scenarios: WorkflowScenarioCatalog = Arr.make(
  byId[taskBriefingWorkflowScenarioId],
  byId[chatHandoffWorkflowScenarioId],
  byId[retrievalRequiredWorkflowScenarioId],
  byId[renderSensitiveWorkflowScenarioId]
)

export const scenarioById = (id: WorkflowScenarioId): WorkflowScenario => byId[id]
