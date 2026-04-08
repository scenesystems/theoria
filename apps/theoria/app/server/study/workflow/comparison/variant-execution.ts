import { Effect, Ref } from "effect"
import type { WorkflowStateLane } from "effect-inference/Contracts"

import {
  WorkflowComparisonExecutionError,
  type WorkflowComparisonExecutionLane,
  type WorkflowComparisonNodeExecution,
  type WorkflowComparisonVariantExecution
} from "../../../../contracts/study/workflow/comparison/run.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import { aggregateScoreForNodeExecutions, evaluateVariantExecutionEffect } from "./evaluation.js"
import type { FrozenWorkflowComparisonRun } from "./frozen.js"
import type { WorkflowComparisonVariantPlan } from "./runtime-plan.js"
import {
  activeStateLanesForState,
  advanceExecutionState,
  initialExecutionState,
  type WorkflowExecutionState
} from "./runtime-state.js"
import { finalizeVariantExecution, nodeExecutionForVariant } from "./runtime.js"

type WorkflowComparisonVariantNodeRequest = {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly plan: WorkflowComparisonVariantPlan
  readonly state: WorkflowExecutionState
  readonly nodeId: string
  readonly stepIndex: number
  readonly stepCount: number
}

type WorkflowComparisonVariantNodeObservation = {
  readonly activeStateLanes: ReadonlyArray<WorkflowStateLane>
  readonly aggregateScore: number
  readonly nodeExecution: WorkflowComparisonNodeExecution
  readonly nodeExecutions: ReadonlyArray<WorkflowComparisonNodeExecution>
}

type WorkflowComparisonVariantNodeExecutor<E, R> = (
  request: WorkflowComparisonVariantNodeRequest
) => Effect.Effect<WorkflowComparisonNodeExecution, WorkflowComparisonExecutionError | E, DspProviderRuntime | R>

type WorkflowComparisonVariantNodeObserver<E, R> = (
  args: WorkflowComparisonVariantNodeObservation
) => Effect.Effect<void, E, R>

const executionError = (message: string) =>
  new WorkflowComparisonExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const indexedTraversal = (plan: WorkflowComparisonVariantPlan) =>
  plan.graphProjection.traversal.map((nodeId, index) => ({
    nodeId,
    stepIndex: index + 1,
    stepCount: plan.graphProjection.traversal.length
  }))

const progressAggregateScore = ({
  nodeExecutions,
  plan
}: {
  readonly nodeExecutions: ReadonlyArray<WorkflowComparisonNodeExecution>
  readonly plan: WorkflowComparisonVariantPlan
}) =>
  aggregateScoreForNodeExecutions({ nodeExecutions, plan }).pipe(
    Effect.mapError(() => executionError(`Workflow score aggregation failed during the ${plan.variant} variant.`))
  )

const noopObserver = () => Effect.void

export const executeWorkflowComparisonVariantPlan = <
  NodeError = never,
  NodeEnv = never,
  ObserveError = never,
  ObserveEnv = never
>({
  comparison,
  lane,
  observeNodeExecution,
  plan,
  executeNode
}: {
  readonly comparison: FrozenWorkflowComparisonRun
  readonly lane: WorkflowComparisonExecutionLane
  readonly observeNodeExecution?: WorkflowComparisonVariantNodeObserver<ObserveError, ObserveEnv>
  readonly plan: WorkflowComparisonVariantPlan
  readonly executeNode?: WorkflowComparisonVariantNodeExecutor<NodeError, NodeEnv>
}): Effect.Effect<
  WorkflowComparisonVariantExecution,
  WorkflowComparisonExecutionError | NodeError | ObserveError,
  DspProviderRuntime | NodeEnv | ObserveEnv
> =>
  Effect.gen(function*() {
    const resolvedExecuteNode: WorkflowComparisonVariantNodeExecutor<NodeError, NodeEnv> = executeNode ??
      ((request) => nodeExecutionForVariant(request))
    const resolvedObserveNodeExecution: WorkflowComparisonVariantNodeObserver<ObserveError, ObserveEnv> =
      observeNodeExecution ?? noopObserver
    const stateRef = yield* Ref.make(initialExecutionState(plan.record))
    const nodeExecutionsRef = yield* Ref.make<ReadonlyArray<WorkflowComparisonNodeExecution>>([])
    const nodeExecutions = yield* Effect.forEach(
      indexedTraversal(plan),
      ({ nodeId, stepCount, stepIndex }) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)
          const nodeExecution = yield* resolvedExecuteNode({
            comparison,
            lane,
            plan,
            state,
            nodeId,
            stepCount,
            stepIndex
          })
          const nextState = advanceExecutionState({
            state,
            node: nodeExecution.node,
            outputText: nodeExecution.outputText
          })

          yield* Ref.set(stateRef, nextState)

          const executions = yield* Ref.updateAndGet(nodeExecutionsRef, (current) => [...current, nodeExecution])
          const aggregateScore = yield* progressAggregateScore({
            nodeExecutions: executions,
            plan
          })

          yield* resolvedObserveNodeExecution({
            activeStateLanes: activeStateLanesForState({ plan, state: nextState }),
            aggregateScore,
            nodeExecution,
            nodeExecutions: executions
          })

          return nodeExecution
        })
    )
    const report = yield* evaluateVariantExecutionEffect({
      comparison,
      nodeExecutions,
      plan
    })

    return yield* finalizeVariantExecution({
      nodeExecutions,
      plan,
      report
    })
  })
