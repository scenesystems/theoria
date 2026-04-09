import { Effect, Option } from "effect"

import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import { WorkflowStudyExecutionError } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import {
  baselineWorkflowVariantSelection as baselineWorkflowVariantSelectionContract,
  optimizedWorkflowVariantSelection as optimizedWorkflowVariantSelectionContract,
  type WorkflowSelectedKnobs,
  type WorkflowVariantSelection
} from "../../../../contracts/study/workflow/runtime-plan.js"
import type { WorkflowEntrySelection } from "../../../../contracts/study/workflow/selection.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import { executeWorkflowVariant } from "../evaluation/variant-execution.js"
import { workflowEntrySelectionUsesSearchWinner, workflowSelectedKnobsForRecord } from "../selection-controls.js"
import type { WorkflowSearchDimension } from "./dimensions.js"
import { WorkflowSearchEvaluation, type WorkflowSearchStudyResult } from "./schema.js"
import { recordForSelection, selectionKey } from "./selection-record.js"

export const baselineWorkflowVariantSelection = ({
  workflowRun,
  plan
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly plan: WorkflowEntrySelection
}): WorkflowVariantSelection =>
  baselineWorkflowVariantSelectionContract({
    profile: workflowRun.baseline.profile,
    record: workflowRun.baseline.record,
    selectedKnobs: workflowSelectedKnobsForRecord({
      plan,
      record: workflowRun.baseline.record
    })
  })

export const optimizedWorkflowVariantSelection = ({
  workflowRun,
  plan,
  searchStudy
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly plan: WorkflowEntrySelection
  readonly searchStudy: Option.Option<WorkflowSearchStudyResult>
}): WorkflowVariantSelection => {
  const authoredSelection = optimizedWorkflowVariantSelectionContract({
    profile: workflowRun.optimized.profile,
    record: workflowRun.optimized.record,
    selectedKnobs: workflowSelectedKnobsForRecord({
      plan,
      record: workflowRun.optimized.record
    })
  })

  return Option.match(searchStudy, {
    onNone: () => authoredSelection,
    onSome: ({ outcome }) =>
      workflowEntrySelectionUsesSearchWinner(plan)
        ? optimizedWorkflowVariantSelectionContract({
          profile: workflowRun.optimized.profile,
          record: outcome.winner.execution.record,
          selectedKnobs: outcome.winner.selection
        })
        : authoredSelection
  })
}

export type WorkflowSearchSelectionEvaluationRequest = {
  readonly workflowRun: FrozenWorkflowRun
  readonly dimensions: ReadonlyArray<WorkflowSearchDimension>
  readonly lane: WorkflowExecutionLane
  readonly selection: WorkflowSelectedKnobs
}

export const evaluateWorkflowSearchSelection = ({
  workflowRun,
  dimensions,
  lane,
  selection
}: WorkflowSearchSelectionEvaluationRequest): Effect.Effect<
  WorkflowSearchEvaluation,
  WorkflowStudyExecutionError,
  DspProviderRuntime
> =>
  Effect.gen(function*() {
    const record = recordForSelection({ workflowRun, dimensions, selection })
    const execution = yield* executeWorkflowVariant({
      workflowRun,
      lane,
      selection: optimizedWorkflowVariantSelectionContract({
        profile: workflowRun.optimized.profile,
        record,
        selectedKnobs: selection
      })
    })

    return yield* Effect.try({
      try: () =>
        WorkflowSearchEvaluation.make({
          selection,
          selectionKey: selectionKey({ dimensions, selection }),
          execution
        }),
      catch: () =>
        new WorkflowStudyExecutionError({
          code: "execution-failed",
          message: "Workflow search evaluation assembly failed.",
          retryable: false
        })
    })
  })

export const replayWorkflowSearchSelection = (
  args: WorkflowSearchSelectionEvaluationRequest
) => evaluateWorkflowSearchSelection(args)
