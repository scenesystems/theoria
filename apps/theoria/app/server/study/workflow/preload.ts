import { Effect } from "effect"

import type { WorkflowSeedId } from "../../../contracts/study/workflow/manifest.js"

import { frozenWorkflowForRequest } from "./frozen.js"
import { programForWorkflow } from "./program.js"

export const preloadWorkflowProgram = (seedId: WorkflowSeedId) =>
  frozenWorkflowForRequest(seedId).pipe(
    Effect.map(programForWorkflow)
  )
