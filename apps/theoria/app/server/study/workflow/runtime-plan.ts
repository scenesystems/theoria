import { Effect, Match } from "effect"
import { WorkflowModuleGraphProjection } from "effect-dsp/contracts"
import { type GraphVariant } from "effect-inference/Contracts"

import {
  type WorkflowStudyExecutionError,
  WorkflowStudyExecutionError as WorkflowStudyExecutionErrorSchema
} from "../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../contracts/study/workflow/frozen.js"
import {
  baselineWorkflowVariantSelection,
  optimizedWorkflowVariantSelection,
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

const frozenVariantSelection = (
  workflowRun: FrozenWorkflowRun,
  variant: GraphVariant
): WorkflowVariantSelection =>
  Match.value(variant).pipe(
    Match.when(
      "baseline",
      () =>
        baselineWorkflowVariantSelection({ profile: workflowRun.baseline.profile, record: workflowRun.baseline.record })
    ),
    Match.when(
      "optimized",
      () =>
        optimizedWorkflowVariantSelection({
          profile: workflowRun.optimized.profile,
          record: workflowRun.optimized.record
        })
    ),
    Match.exhaustive
  )

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
  prepareWorkflowVariantPlanForSelection(frozenVariantSelection(workflowRun, variant))

export const prepareWorkflowVariantPlanForSelection = (
  selection: WorkflowVariantSelection
): Effect.Effect<WorkflowVariantPlan, WorkflowStudyExecutionError, never> =>
  Effect.try({
    try: () =>
      workflowVariantPlanForSelection({
        selection,
        graphProjection: WorkflowModuleGraphProjection.fromWorkflowInput({
          manifest: selection.record.graph,
          projection: selection.record.projection
        })
      }),
    catch: () => executionError(`Workflow graph projection failed for the ${workflowVariantLabel(selection)} variant.`)
  })

const workflowVariantLabel = (selection: WorkflowVariantSelection): GraphVariant =>
  workflowGraphVariantForSelection(selection)
