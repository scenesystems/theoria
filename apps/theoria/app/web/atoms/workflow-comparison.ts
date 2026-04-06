import { Atom } from "@effect-atom/atom"

import {
  workflowComparisonExecutionLanes,
  type WorkflowComparisonRunPlan
} from "../../contracts/workflow/comparison-run.js"
import { type WorkflowComparisonId, workflowComparisonIds } from "../../contracts/workflow/comparison.js"

const defaultWorkflowComparisonId = workflowComparisonIds[0]
const defaultWorkflowComparisonLane = workflowComparisonExecutionLanes[0]

export const workflowComparisonSelectionAtom = Atom.make<WorkflowComparisonId>(defaultWorkflowComparisonId)

export const selectWorkflowComparisonSelectionAtom = Atom.fnSync<WorkflowComparisonId>()((comparisonId, ctx) => {
  ctx.set(workflowComparisonSelectionAtom, comparisonId)
})

export const workflowComparisonRunPlan = (
  comparisonId: WorkflowComparisonId
): WorkflowComparisonRunPlan => ({
  consumerId: "workflow-comparison",
  comparisonId,
  lane: defaultWorkflowComparisonLane
})
