import { Chunk } from "effect"
import type { ScoreComponentResult, WorkflowEvaluationReport } from "effect-inference/Contracts"
import * as Statistics from "effect-math/Statistics"

import type { WorkflowVariantPlan } from "../../../../contracts/study/workflow/runtime-plan.js"

const zeroToOne = (value: number): number => Math.max(0, Math.min(1, value))

const average = (values: ReadonlyArray<number>): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const zeroLossSummary = (): WorkflowEvaluationReport["lossSummary"] => ({
  count: 0,
  mean: 0,
  minimum: 0,
  maximum: 0,
  variance: 0,
  standardDeviation: 0
})

export const lossSummaryFromScores = (
  scores: ReadonlyArray<number>
): WorkflowEvaluationReport["lossSummary"] => {
  const losses = scores.map((score) => zeroToOne(1 - score))

  if (losses.length === 0) {
    return zeroLossSummary()
  }

  const lossChunk = Chunk.unsafeFromArray(losses)

  if (!Chunk.isNonEmpty(lossChunk)) {
    return zeroLossSummary()
  }

  const summary = Statistics.lossSummary(lossChunk)

  return {
    count: summary.count,
    mean: summary.mean,
    minimum: summary.min,
    maximum: summary.max,
    variance: summary.variance,
    standardDeviation: summary.standardDeviation
  }
}

export const aggregatedComponentBreakdown = (
  caseResults: ReadonlyArray<{
    readonly components: ReadonlyArray<ScoreComponentResult>
  }>,
  plan: WorkflowVariantPlan
): ReadonlyArray<ScoreComponentResult> =>
  plan.profile.components.map((component) => {
    const componentResults = caseResults.flatMap((caseResult) =>
      caseResult.components.filter((result) => result.component === component)
    )
    const sample = componentResults[0]

    return {
      component,
      rawValue: average(componentResults.map((result) => result.rawValue)),
      normalizedValue: average(componentResults.map((result) => result.normalizedValue)),
      weight: sample?.weight ?? plan.profile.weights[component],
      weightedValue: average(componentResults.map((result) => result.weightedValue))
    }
  })
