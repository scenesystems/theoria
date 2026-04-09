import { Effect } from "effect"

import type { WorkflowScenarioId } from "../../../contracts/study/workflow/manifest.js"

import { frozenWorkflowForRequest } from "./frozen.js"
import { programForWorkflow } from "./program.js"

export const preloadWorkflowProgram = (scenarioId: WorkflowScenarioId) =>
  frozenWorkflowForRequest(scenarioId).pipe(
    Effect.map(programForWorkflow)
  )
