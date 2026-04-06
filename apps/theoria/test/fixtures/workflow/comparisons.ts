import { Array as Arr, Option } from "effect"

import type {
  WorkflowComparison,
  WorkflowComparisonCatalog,
  WorkflowComparisonId
} from "../../../app/contracts/workflow/comparison.js"
import { chatHandoffWorkflowComparison } from "./chat-handoff-comparison.js"
import { taskBriefingWorkflowComparison } from "./task-briefing-comparison.js"

export const workflowComparisons: WorkflowComparisonCatalog = Arr.make(
  taskBriefingWorkflowComparison,
  chatHandoffWorkflowComparison
)

export const defaultWorkflowComparisonId: WorkflowComparisonId = taskBriefingWorkflowComparison.id

export const workflowComparisonById = (id: WorkflowComparisonId): WorkflowComparison =>
  Option.getOrElse(
    Arr.findFirst(workflowComparisons, (comparison) => comparison.id === id),
    () => taskBriefingWorkflowComparison
  )
