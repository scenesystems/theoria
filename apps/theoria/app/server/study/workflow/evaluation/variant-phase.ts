import { Effect, Ref } from "effect"

import type { EvidenceEvent } from "../../../../contracts/evidence/stream.js"
import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import type { WorkflowVariantExecution } from "../../../../contracts/study/workflow/execution.js"
import type { WorkflowStudyExecutionError } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import {
  workflowGraphVariantForPlan,
  type WorkflowVariantSelection
} from "../../../../contracts/study/workflow/runtime-plan.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import { nodeExecutionEvents, variantEndEvents, variantStartEvents } from "../evidence/events.js"
import { prepareWorkflowVariantPlan } from "../runtime-plan.js"
import { executeWorkflowVariantPlan } from "./variant-execution.js"

export const runWorkflowVariantPhase = ({
  workflowRun,
  lane,
  selection
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly selection: WorkflowVariantSelection
}): Effect.Effect<
  { readonly events: ReadonlyArray<EvidenceEvent>; readonly execution: WorkflowVariantExecution },
  WorkflowStudyExecutionError,
  DspProviderRuntime
> =>
  Effect.gen(function*() {
    const plan = yield* prepareWorkflowVariantPlan({ selection })
    const variant = workflowGraphVariantForPlan(plan)
    const eventBufferRef = yield* Ref.make<ReadonlyArray<EvidenceEvent>>(
      variantStartEvents({
        variant,
        graphProjection: plan.graphProjection,
        record: plan.record
      })
    )
    const execution = yield* executeWorkflowVariantPlan({
      workflowRun,
      lane,
      plan,
      observeNodeExecution: ({ activeStateLanes, aggregateScore, nodeExecution }) =>
        Ref.update(eventBufferRef, (events) => [
          ...events,
          ...nodeExecutionEvents({
            seedId: workflowRun.seedId,
            execution: nodeExecution,
            workflowKind: workflowRun.workflowKind,
            aggregateScore,
            activeStateLanes
          })
        ])
    })

    return {
      execution,
      events: yield* Ref.updateAndGet(eventBufferRef, (events) => [...events, ...variantEndEvents(variant)])
    }
  })
