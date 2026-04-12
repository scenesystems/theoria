import { Effect } from "effect"
import type { ScoreComponentResult } from "effect-inference/Contracts"

import {
  type WorkflowNodeExecution,
  WorkflowStudyExecutionError
} from "../../../../contracts/study/workflow/execution.js"
import type { FrozenWorkflowRun } from "../../../../contracts/study/workflow/frozen.js"
import {
  workflowGraphVariantForPlan,
  type WorkflowVariantPlan
} from "../../../../contracts/study/workflow/runtime-plan.js"
import { decodeWorkflowEvaluationReport } from "../../../../contracts/study/workflow/scenario.js"
import { aggregateScore, caseComponentResults } from "./scoring-components.js"
import { executionFeatures } from "./scoring-features.js"
import { aggregatedComponentBreakdown, lossSummaryFromScores } from "./scoring-summary.js"

type WorkflowExecutionCaseResult = {
  readonly caseId: string
  readonly components: ReadonlyArray<ScoreComponentResult>
  readonly loss: number
  readonly score: number
}

const caseResultsForExecution = ({
  nodeExecutions,
  plan
}: {
  readonly nodeExecutions: ReadonlyArray<WorkflowNodeExecution>
  readonly plan: WorkflowVariantPlan
}): Effect.Effect<ReadonlyArray<WorkflowExecutionCaseResult>, unknown, never> =>
  executionFeatures({ plan, nodeExecutions }).pipe(
    Effect.map((features) =>
      plan.record.evaluation.cases.map((evaluationCase) => {
        const components = caseComponentResults({
          casePrompt: evaluationCase.prompt,
          expectedSignals: evaluationCase.expectedSignals,
          features,
          plan,
          renderCritical: evaluationCase.renderCritical
        })
        const score = aggregateScore(components)

        return {
          caseId: evaluationCase.caseId,
          score,
          loss: Math.max(0, Math.min(1, 1 - score)),
          components
        }
      })
    )
  )

const executionError = (message: string) =>
  new WorkflowStudyExecutionError({
    code: "execution-failed",
    message,
    retryable: false
  })

export const aggregateScoreForNodeExecutions = ({
  nodeExecutions,
  plan
}: {
  readonly nodeExecutions: ReadonlyArray<WorkflowNodeExecution>
  readonly plan: WorkflowVariantPlan
}): Effect.Effect<number, unknown, never> =>
  nodeExecutions.length === 0
    ? Effect.succeed(0)
    : caseResultsForExecution({ nodeExecutions, plan }).pipe(
      Effect.map((caseResults) => aggregateScore(aggregatedComponentBreakdown(caseResults, plan)))
    )

export const evaluateVariantExecutionEffect = ({
  workflowRun,
  nodeExecutions,
  plan
}: {
  readonly workflowRun: FrozenWorkflowRun
  readonly nodeExecutions: ReadonlyArray<WorkflowNodeExecution>
  readonly plan: WorkflowVariantPlan
}) =>
  Effect.gen(function*() {
    const variant = workflowGraphVariantForPlan(plan)
    const caseResults = yield* caseResultsForExecution({ nodeExecutions, plan }).pipe(
      Effect.mapError(() => executionError(`Workflow score evaluation failed for the ${variant} variant.`))
    )
    const componentBreakdown = aggregatedComponentBreakdown(caseResults, plan)

    return decodeWorkflowEvaluationReport({
      reportId: `${workflowRun.scenarioId}-${variant}-runtime-report`,
      workflowKind: plan.record.workflowKind,
      profile: plan.profile,
      totalCases: caseResults.length,
      aggregateScore: aggregateScore(componentBreakdown),
      componentBreakdown,
      lossSummary: lossSummaryFromScores(caseResults.map((caseResult) => caseResult.score)),
      caseResults
    })
  })
