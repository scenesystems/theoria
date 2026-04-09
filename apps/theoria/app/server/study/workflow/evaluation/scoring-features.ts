import { Effect } from "effect"
import type { WorkflowNodeKind } from "effect-inference/Contracts"

import {
  workflowNodeExecutionLatencyMs,
  workflowNodeExecutionTotalTokens
} from "../../../../contracts/study/workflow/evidence.js"
import type { WorkflowNodeExecution } from "../../../../contracts/study/workflow/execution.js"
import type { WorkflowVariantPlan } from "../../../../contracts/study/workflow/runtime-plan.js"
import { renderEvidenceForText, type WorkflowRenderEvidence } from "../render-evidence.js"

export type ExecutionFeatures = {
  readonly averageOutputLength: number
  readonly conversationTurnCount: number
  readonly nodeKinds: ReadonlyArray<WorkflowNodeKind>
  readonly normalizedText: string
  readonly renderEvidence: WorkflowRenderEvidence
  readonly runtimeEvidenceCompleteness: number
  readonly stepCount: number
  readonly totalLatencyMs: number
  readonly totalTokenCost: number
}

const average = (values: ReadonlyArray<number>): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

export const executionFeatures = ({
  plan,
  nodeExecutions
}: {
  readonly plan: WorkflowVariantPlan
  readonly nodeExecutions: ReadonlyArray<WorkflowNodeExecution>
}): Effect.Effect<ExecutionFeatures, unknown, never> => {
  const text = nodeExecutions.map((execution) => execution.outputText).join(" ").toLowerCase()
  const runtimeEvidenceCompleteness = average(
    nodeExecutions.map((execution) => {
      const hasDesiredRuntime = execution.runtimeEvidence.desired.artifact.modelRef.length > 0
      const hasResolvedRoute = execution.runtimeEvidence.resolvedRoute.route.family.length > 0
      const hasResolvedRuntime = execution.runtimeEvidence.resolvedRuntime.responseModel.length > 0

      return hasDesiredRuntime && hasResolvedRoute && hasResolvedRuntime ? 1 : 0
    })
  )

  return renderEvidenceForText(text).pipe(
    Effect.map((renderEvidence) => ({
      averageOutputLength: average(nodeExecutions.map((execution) => execution.outputText.length)),
      conversationTurnCount: plan.record.session.turns.length,
      nodeKinds: nodeExecutions.map((execution) => execution.node.nodeKind),
      normalizedText: text,
      renderEvidence,
      runtimeEvidenceCompleteness,
      stepCount: nodeExecutions.length,
      totalLatencyMs: nodeExecutions.reduce((sum, execution) => sum + workflowNodeExecutionLatencyMs(execution), 0),
      totalTokenCost: nodeExecutions.reduce((sum, execution) => sum + workflowNodeExecutionTotalTokens(execution), 0)
    }))
  )
}
