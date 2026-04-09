import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import type {
  WorkflowScenario,
  WorkflowScenarioCatalog,
  WorkflowScenarioId
} from "../../../../contracts/study/workflow/scenario.js"
import { workflowScenarioId } from "../../../../contracts/study/workflow/scenario.js"
import { chatHandoffWorkflowScenario } from "./chat-handoff.js"
import { renderSensitiveWorkflowScenario } from "./render-sensitive.js"
import { retrievalRequiredWorkflowScenario } from "./retrieval-required.js"
import { taskBriefingWorkflowScenario } from "./task-briefing.js"

export const workflowScenarios: WorkflowScenarioCatalog = Arr.make(
  taskBriefingWorkflowScenario,
  chatHandoffWorkflowScenario,
  retrievalRequiredWorkflowScenario,
  renderSensitiveWorkflowScenario
)

export const workflowScenarioByIdOption = (
  id: WorkflowScenarioId
): Option.Option<WorkflowScenario> =>
  Arr.findFirst(workflowScenarios, (scenario) => workflowScenarioId(scenario) === id)

export const workflowScenarioById = (id: WorkflowScenarioId): WorkflowScenario =>
  Option.getOrElse(workflowScenarioByIdOption(id), () => taskBriefingWorkflowScenario)
