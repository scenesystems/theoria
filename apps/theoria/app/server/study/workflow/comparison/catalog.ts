import * as Arr from "effect/Array"
import * as Option from "effect/Option"

import type {
  WorkflowComparison,
  WorkflowComparisonCatalog,
  WorkflowComparisonId
} from "../../../../contracts/study/workflow/comparison/comparison.js"
import { workflowComparisonId } from "../../../../contracts/study/workflow/comparison/comparison.js"
import { chatHandoffWorkflowComparison } from "./chat-handoff.js"
import { renderSensitiveWorkflowComparison } from "./render-sensitive.js"
import { retrievalRequiredWorkflowComparison } from "./retrieval-required.js"
import { taskBriefingWorkflowComparison } from "./task-briefing.js"

export { defaultWorkflowComparisonId } from "../../../../contracts/study/workflow/comparison/comparison.js"

export const workflowComparisons: WorkflowComparisonCatalog = Arr.make(
  taskBriefingWorkflowComparison,
  chatHandoffWorkflowComparison,
  retrievalRequiredWorkflowComparison,
  renderSensitiveWorkflowComparison
)

export const workflowComparisonOptionById = (
  id: WorkflowComparisonId
): Option.Option<WorkflowComparison> =>
  Arr.findFirst(workflowComparisons, (comparison) => workflowComparisonId(comparison) === id)

export const workflowComparisonById = (id: WorkflowComparisonId): WorkflowComparison =>
  Option.getOrElse(workflowComparisonOptionById(id), () => taskBriefingWorkflowComparison)
