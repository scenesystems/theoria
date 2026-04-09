import { Effect, Option } from "effect"
import type { WorkflowEvaluationReport } from "effect-inference/Contracts"

import {
  type WorkflowNodeExecution,
  WorkflowStudyExecutionError,
  WorkflowVariantExecution
} from "../../../../contracts/study/workflow/execution.js"
import {
  workflowGraphVariantForPlan,
  type WorkflowVariantPlan
} from "../../../../contracts/study/workflow/runtime-plan.js"

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

export const finalizeVariantExecution = ({
  nodeExecutions,
  plan,
  report
}: {
  readonly nodeExecutions: ReadonlyArray<WorkflowNodeExecution>
  readonly plan: WorkflowVariantPlan
  readonly report: WorkflowEvaluationReport
}): Effect.Effect<WorkflowVariantExecution, WorkflowStudyExecutionError, never> => {
  const [firstNodeExecution, ...restNodeExecutions] = nodeExecutions
  const variant = workflowGraphVariantForPlan(plan)

  return Option.fromNullable(firstNodeExecution).pipe(
    Option.match({
      onNone: () => Effect.fail(executionError(`Workflow graph traversal for ${variant} produced no node executions.`)),
      onSome: (headNodeExecution) =>
        Effect.try({
          try: () =>
            WorkflowVariantExecution.make({
              variant,
              record: plan.record,
              report,
              graphProjection: plan.graphProjection,
              nodeExecutions: [headNodeExecution, ...restNodeExecutions]
            }),
          catch: () => executionError(`Workflow result assembly failed for the ${variant} variant.`)
        })
    })
  )
}
