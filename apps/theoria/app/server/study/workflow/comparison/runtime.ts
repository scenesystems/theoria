import { Effect, Option, Schema } from "effect"
import type { WorkflowModuleGraphProjection } from "effect-dsp/contracts"
import type {
  NodeExecutionContract,
  WorkflowEvaluationReport,
  WorkflowExecutionRecord
} from "effect-inference/Contracts"

import {
  WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane,
  type WorkflowComparisonNodeExecution,
  WorkflowComparisonNodeExecution as WorkflowComparisonNodeExecutionSchema,
  type WorkflowComparisonVariantExecution,
  WorkflowComparisonVariantExecution as WorkflowComparisonVariantExecutionSchema
} from "../../../../contracts/study/workflow/comparison/run.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import { executeWorkflowNode } from "./node-execution.js"
import type { WorkflowComparisonVariantPlan } from "./runtime-plan.js"
import type { WorkflowExecutionState } from "./runtime-state.js"

const makeNodeExecution = Schema.decodeUnknownSync(WorkflowComparisonNodeExecutionSchema)
const makeVariantExecution = Schema.decodeUnknownSync(WorkflowComparisonVariantExecutionSchema)

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
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
): Effect.Effect<NodeExecutionContract, WorkflowComparisonExecutionError, never> =>
  Option.fromNullable(record.graph.nodes.find((node) => node.nodeId === nodeId)).pipe(
    Option.match({
      onNone: () => Effect.fail(executionError(`Workflow graph node ${nodeId} is missing from the manifest.`)),
      onSome: Effect.succeed
    })
  )

export const nodeExecutionForVariant = ({
  comparison,
  lane,
  plan,
  state,
  stepIndex,
  stepCount,
  nodeId
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly plan: WorkflowComparisonVariantPlan
  readonly state: WorkflowExecutionState
  readonly stepIndex: number
  readonly stepCount: number
  readonly nodeId: string
}): Effect.Effect<WorkflowComparisonNodeExecution, WorkflowComparisonExecutionError, DspProviderRuntime> =>
  Effect.gen(function*() {
    const node = yield* nodeForId(plan.record, nodeId)
    const nodeExecution = yield* executeWorkflowNode({
      comparison,
      lane,
      node,
      record: plan.record,
      selectedKnobs: plan.selectedKnobs,
      state,
      variant: plan.variant
    })

    return makeNodeExecution({
      variant: plan.variant,
      node,
      lineage: lineageForNode(plan.graphProjection, nodeId),
      stepIndex,
      stepCount,
      outputText: nodeExecution.outputText,
      trace: nodeExecution.trace,
      runtimeEvidence: nodeExecution.runtimeEvidence
    })
  })

export const finalizeVariantExecution = ({
  nodeExecutions,
  plan,
  report
}: {
  readonly nodeExecutions: ReadonlyArray<WorkflowComparisonNodeExecution>
  readonly plan: WorkflowComparisonVariantPlan
  readonly report: WorkflowEvaluationReport
}): Effect.Effect<WorkflowComparisonVariantExecution, WorkflowComparisonExecutionError, never> =>
  nodeExecutions.length === 0
    ? Effect.fail(executionError(`Workflow graph traversal for ${plan.variant} produced no node executions.`))
    : Effect.try({
      try: () =>
        makeVariantExecution({
          variant: plan.variant,
          record: plan.record,
          report,
          graphProjection: plan.graphProjection,
          nodeExecutions: [nodeExecutions[0], ...nodeExecutions.slice(1)]
        }),
      catch: () => executionError(`Workflow comparison result assembly failed for the ${plan.variant} variant.`)
    })
