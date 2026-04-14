import { Effect, Option, Ref } from "effect"
import type { WorkflowStateLane } from "effect-inference/Contracts"

import type { WorkflowExecutionLane } from "../../../../contracts/study/workflow/controls.js"
import {
  type WorkflowNodeExecution,
  WorkflowStudyExecutionError,
  type WorkflowVariantExecution
} from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import {
  workflowGraphVariantForPlan,
  type WorkflowVariantPlan,
  type WorkflowVariantSelection
} from "../../../../contracts/study/workflow/runtime-plan.js"
import type { DspProviderRuntime } from "../../../capability/effect-dsp.js"
import { prepareWorkflowVariantPlan } from "../runtime-plan.js"
import { finalizeVariantExecution } from "./execution-result.js"
import {
  activeStateLanesForState,
  advanceExecutionState,
  initialExecutionState,
  type WorkflowExecutionState
} from "./execution-state.js"
import { nodeExecutionForVariant } from "./node-execution.js"
import { aggregateScoreForNodeExecutions, evaluateVariantExecutionEffect } from "./report.js"

type WorkflowVariantNodeRequest = {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly plan: WorkflowVariantPlan
  readonly state: WorkflowExecutionState
  readonly nodeId: string
  readonly stepIndex: number
  readonly stepCount: number
}

type WorkflowVariantNodeObservation = {
  readonly activeStateLanes: ReadonlyArray<WorkflowStateLane>
  readonly aggregateScore: number
  readonly nodeExecution: WorkflowNodeExecution
  readonly nodeExecutions: ReadonlyArray<WorkflowNodeExecution>
}

type WorkflowVariantNodeExecutor<E, R> = (
  request: WorkflowVariantNodeRequest
) => Effect.Effect<WorkflowNodeExecution, WorkflowStudyExecutionError | E, DspProviderRuntime | R>

type WorkflowVariantNodeObserver<E, R> = (
  args: WorkflowVariantNodeObservation
) => Effect.Effect<void, E, R>

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

const indexedTraversal = (plan: WorkflowVariantPlan) =>
  plan.graphProjection.traversal.map((nodeId, index) => ({
    nodeId,
    stepIndex: index + 1,
    stepCount: plan.graphProjection.traversal.length
  }))

const progressAggregateScore = ({
  nodeExecutions,
  plan
}: {
  readonly nodeExecutions: ReadonlyArray<WorkflowNodeExecution>
  readonly plan: WorkflowVariantPlan
}) =>
  aggregateScoreForNodeExecutions({ nodeExecutions, plan }).pipe(
    Effect.mapError(
      () => executionError(`Workflow score aggregation failed during the ${workflowGraphVariantForPlan(plan)} variant.`)
    )
  )

const noopObserver = () => Effect.void

export const executeWorkflowVariant = <
  NodeError = never,
  NodeEnv = never,
  ObserveError = never,
  ObserveEnv = never
>({
  workflowRun,
  lane,
  observeNodeExecution,
  selection,
  executeNode
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly observeNodeExecution?: WorkflowVariantNodeObserver<ObserveError, ObserveEnv>
  readonly selection: WorkflowVariantSelection
  readonly executeNode?: WorkflowVariantNodeExecutor<NodeError, NodeEnv>
}): Effect.Effect<
  WorkflowVariantExecution,
  WorkflowStudyExecutionError | NodeError | ObserveError,
  DspProviderRuntime | NodeEnv | ObserveEnv
> =>
  Effect.gen(function*() {
    const plan = yield* prepareWorkflowVariantPlan({ selection })

    return yield* executeWorkflowVariantPlan({
      workflowRun,
      lane,
      plan,
      ...Option.match(Option.fromNullable(observeNodeExecution), {
        onNone: () => ({}),
        onSome: (value) => ({ observeNodeExecution: value })
      }),
      ...Option.match(Option.fromNullable(executeNode), {
        onNone: () => ({}),
        onSome: (value) => ({ executeNode: value })
      })
    })
  })

export const executeWorkflowVariantPlan = <
  NodeError = never,
  NodeEnv = never,
  ObserveError = never,
  ObserveEnv = never
>({
  workflowRun,
  lane,
  observeNodeExecution,
  plan,
  executeNode
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly lane: WorkflowExecutionLane
  readonly observeNodeExecution?: WorkflowVariantNodeObserver<ObserveError, ObserveEnv>
  readonly plan: WorkflowVariantPlan
  readonly executeNode?: WorkflowVariantNodeExecutor<NodeError, NodeEnv>
}): Effect.Effect<
  WorkflowVariantExecution,
  WorkflowStudyExecutionError | NodeError | ObserveError,
  DspProviderRuntime | NodeEnv | ObserveEnv
> =>
  Effect.gen(function*() {
    const resolvedExecuteNode: WorkflowVariantNodeExecutor<NodeError, NodeEnv> = executeNode ??
      ((request) => nodeExecutionForVariant(request))
    const resolvedObserveNodeExecution: WorkflowVariantNodeObserver<ObserveError, ObserveEnv> = observeNodeExecution ??
      noopObserver
    const stateRef = yield* Ref.make(initialExecutionState(plan.record))
    const nodeExecutionsRef = yield* Ref.make<ReadonlyArray<WorkflowNodeExecution>>([])
    const nodeExecutions = yield* Effect.forEach(
      indexedTraversal(plan),
      ({ nodeId, stepCount, stepIndex }) =>
        Effect.gen(function*() {
          const state = yield* Ref.get(stateRef)
          const nodeExecution = yield* resolvedExecuteNode({
            workflowRun,
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
      workflowRun,
      nodeExecutions,
      plan
    })

    return yield* finalizeVariantExecution({
      nodeExecutions,
      plan,
      report
    })
  })
