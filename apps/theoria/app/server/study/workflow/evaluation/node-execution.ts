import { Effect, Option } from "effect"
import type { WorkflowModuleGraphProjection } from "effect-dsp/contracts"
import type { NodeExecutionContract, WorkflowExecutionRecord } from "effect-inference/Contracts"

import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import { WorkflowNodeExecution, WorkflowStudyExecutionError } from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import {
  workflowGraphVariantForPlan,
  type WorkflowVariantPlan
} from "../../../../contracts/study/workflow/runtime-plan.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import type { WorkflowExecutionState } from "./execution-state.js"
import { executeWorkflowNode } from "./node-runtime.js"

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const lineageForNode = (
  graphProjection: WorkflowModuleGraphProjection,
  nodeId: string
): ReadonlyArray<string> => graphProjection.lineages.find((lineage) => lineage.targetNodeId === nodeId)?.path ?? []

const nodeForId = (
  record: WorkflowExecutionRecord,
  nodeId: string
): Effect.Effect<NodeExecutionContract, WorkflowStudyExecutionError, never> =>
  Option.fromNullable(record.graph.nodes.find((node) => node.nodeId === nodeId)).pipe(
    Option.match({
      onNone: () => Effect.fail(executionError(`Workflow graph node ${nodeId} is missing from the manifest.`)),
      onSome: Effect.succeed
    })
  )

export const nodeExecutionForVariant = ({
  workflowRun,
  lane,
  plan,
  state,
  stepIndex,
  stepCount,
  nodeId
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly plan: WorkflowVariantPlan
  readonly state: WorkflowExecutionState
  readonly stepIndex: number
  readonly stepCount: number
  readonly nodeId: string
}): Effect.Effect<WorkflowNodeExecution, WorkflowStudyExecutionError, DspProviderRuntime> =>
  Effect.gen(function*() {
    const variant = workflowGraphVariantForPlan(plan)
    const node = yield* nodeForId(plan.record, nodeId)
    const nodeExecution = yield* executeWorkflowNode({
      workflowRun,
      lane,
      node,
      record: plan.record,
      selectedKnobs: plan.selectedKnobs,
      state,
      variant
    })

    return WorkflowNodeExecution.make({
      variant,
      node,
      lineage: lineageForNode(plan.graphProjection, nodeId),
      stepIndex,
      stepCount,
      outputText: nodeExecution.outputText,
      trace: nodeExecution.trace,
      runtimeEvidence: nodeExecution.runtimeEvidence
    })
  })
