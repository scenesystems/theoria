import { Effect } from "effect"

import {
  type WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane
} from "../../../../contracts/study/workflow/comparison/run.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { prepareVariantPlanForRecord, type WorkflowComparisonSelectedKnobs } from "./runtime-plan.js"
import type { WorkflowComparisonSearchEvaluation } from "./search-study-schema.js"
import { recordForSelection, selectionKey, type WorkflowComparisonSearchDimension } from "./search-study-space.js"
import { executeWorkflowComparisonVariantPlan } from "./variant-execution.js"

export type WorkflowComparisonSearchSelectionEvaluationRequest = {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly dimensions: ReadonlyArray<WorkflowComparisonSearchDimension>
  readonly lane: WorkflowComparisonExecutionLane
  readonly selection: WorkflowComparisonSelectedKnobs
}

export const evaluateWorkflowComparisonSearchSelection = ({
  comparison,
  dimensions,
  lane,
  selection
}: WorkflowComparisonSearchSelectionEvaluationRequest): Effect.Effect<
  WorkflowComparisonSearchEvaluation,
  WorkflowComparisonExecutionError,
  DspProviderRuntime
> =>
  Effect.gen(function*() {
    const record = recordForSelection({ comparison, dimensions, selection })
    const plan = yield* prepareVariantPlanForRecord({
      variant: "optimized",
      record,
      profile: comparison.optimized.profile,
      selectedKnobs: selection
    })
    const execution = yield* executeWorkflowComparisonVariantPlan({
      comparison,
      lane,
      plan
    })

    return {
      selection,
      selectionKey: selectionKey({ dimensions, selection }),
      execution
    }
  })

export const replayWorkflowComparisonSearchSelection = (
  args: WorkflowComparisonSearchSelectionEvaluationRequest
) => evaluateWorkflowComparisonSearchSelection(args)
