import { Effect } from "effect"
import { WorkflowGraphProjection } from "effect-dsp/contracts"
import { type GraphVariant } from "effect-inference/Contracts"

import {
  type WorkflowStudyExecutionError,
  WorkflowStudyExecutionError as WorkflowStudyExecutionErrorSchema
} from "../../../contracts/study/workflow/execution.js"
import { FrozenWorkflowRun } from "../../../contracts/study/workflow/frozen.js"
import {
  workflowGraphVariantForSelection,
  type WorkflowVariantPlan,
  workflowVariantPlanForSelection,
  type WorkflowVariantSelection
} from "../../../contracts/study/workflow/runtime-plan.js"

const executionError = (message: string): WorkflowStudyExecutionError =>
  new WorkflowStudyExecutionErrorSchema({
    code: "execution-failed",
    message,
    retryable: false
  })

export const prepareWorkflowVariantPlan = ({
  selection
}: {
  readonly selection: WorkflowVariantSelection
}): Effect.Effect<WorkflowVariantPlan, WorkflowStudyExecutionError, never> =>
  prepareWorkflowVariantPlanForSelection(selection)

export const prepareWorkflowVariantPlanForFrozenRun = ({
  variant,
  workflowRun
}: {
  readonly variant: GraphVariant
  readonly workflowRun: FrozenWorkflowRun
}): Effect.Effect<WorkflowVariantPlan, WorkflowStudyExecutionError, never> =>
  prepareWorkflowVariantPlanForSelection(FrozenWorkflowRun.selectionForVariant(workflowRun, variant))

export const prepareWorkflowVariantPlanForSelection = (
  selection: WorkflowVariantSelection
): Effect.Effect<WorkflowVariantPlan, WorkflowStudyExecutionError, never> =>
  Effect.try({
    try: () =>
      workflowVariantPlanForSelection({
        selection,
        graphProjection: WorkflowGraphProjection.fromInput({
          manifest: selection.record.graph,
          projection: selection.record.projection
        })
      }),
    catch: () => executionError(`Workflow graph projection failed for the ${workflowVariantLabel(selection)} variant.`)
  })

const workflowVariantLabel = (selection: WorkflowVariantSelection): GraphVariant =>
  workflowGraphVariantForSelection(selection)
