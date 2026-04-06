import { describe, expect, it } from "@effect/vitest"
import { Effect, Schema } from "effect"

import * as WorkflowContracts from "effect-inference/Contracts"
import * as Sampler from "effect-search/Sampler"
import * as SearchSpace from "effect-search/SearchSpace"
import * as Study from "effect-search/Study"

const workflowSpace = SearchSpace.unsafeMake({
  critiquePassBudget: SearchSpace.int(1, 3),
  retrievalDepth: SearchSpace.int(1, 3)
})

const workflowProfile = {
  profileId: "task-oriented-graph-proof",
  profileFamily: "task-oriented",
  workflowKinds: ["task-first"],
  components: ["taskSuccess", "latency"],
  weights: {
    taskSuccess: 0.8,
    grounding: 0,
    conversationContinuity: 0,
    routeEfficiency: 0,
    renderFitness: 0,
    tokenCost: 0,
    latency: 0.2
  },
  normalization: {
    taskSuccess: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    grounding: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    conversationContinuity: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    routeEfficiency: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    renderFitness: {
      kind: "support-profile-tolerance",
      direction: "higher-is-better",
      supportProfileRef: "browser/default",
      fontIdentityRef: "Inter",
      fontReadinessRevision: "rev-1",
      toleranceRef: "task-readability"
    },
    tokenCost: { kind: "budget-inverse", direction: "lower-is-better", budget: 1000, unit: "tokens" },
    latency: { kind: "budget-inverse", direction: "lower-is-better", budget: 200, unit: "ms" }
  }
}

const makeWorkflowReport = (config: { readonly critiquePassBudget: number; readonly retrievalDepth: number }) => {
  const taskSuccess = 1 - (Math.abs(config.critiquePassBudget - 2) * 0.2 + Math.abs(config.retrievalDepth - 1) * 0.15)
  const latency = 80 + config.critiquePassBudget * 15 + config.retrievalDepth * 10
  const latencyNormalized = 1 - Math.min(latency / 200, 1)
  const aggregateScore = taskSuccess * workflowProfile.weights.taskSuccess +
    latencyNormalized * workflowProfile.weights.latency

  return {
    reportId: `workflow-${config.critiquePassBudget}-${config.retrievalDepth}`,
    workflowKind: "task-first",
    profile: workflowProfile,
    totalCases: 1,
    aggregateScore,
    componentBreakdown: [
      {
        component: "taskSuccess",
        rawValue: taskSuccess,
        normalizedValue: taskSuccess,
        weight: workflowProfile.weights.taskSuccess,
        weightedValue: taskSuccess * workflowProfile.weights.taskSuccess
      },
      {
        component: "latency",
        rawValue: latency,
        normalizedValue: latencyNormalized,
        weight: workflowProfile.weights.latency,
        weightedValue: latencyNormalized * workflowProfile.weights.latency
      }
    ],
    lossSummary: {
      count: 1,
      mean: 1 - aggregateScore,
      minimum: 1 - aggregateScore,
      maximum: 1 - aggregateScore,
      variance: 0,
      standardDeviation: 0
    },
    caseResults: [
      {
        caseId: `case-${config.critiquePassBudget}-${config.retrievalDepth}`,
        score: aggregateScore,
        loss: 1 - aggregateScore,
        components: [
          {
            component: "taskSuccess",
            rawValue: taskSuccess,
            normalizedValue: taskSuccess,
            weight: workflowProfile.weights.taskSuccess,
            weightedValue: taskSuccess * workflowProfile.weights.taskSuccess
          },
          {
            component: "latency",
            rawValue: latency,
            normalizedValue: latencyNormalized,
            weight: workflowProfile.weights.latency,
            weightedValue: latencyNormalized * workflowProfile.weights.latency
          }
        ]
      }
    ]
  }
}

describe("e2e/effect-search-workflow-objective-seam", () => {
  it.effect("proves the effect-search objective seam against public effect-inference workflow contracts downstream of both packages", () =>
    Effect.gen(function*() {
      const result = yield* Study.maximize({
        space: workflowSpace,
        sampler: Sampler.grid(),
        trials: 9,
        objective: (config) =>
          Schema.decodeUnknown(WorkflowContracts.WorkflowEvaluationReportSchema)(makeWorkflowReport(config), {
            onExcessProperty: "error"
          }).pipe(Effect.map((report) => report.aggregateScore))
      })

      expect(result._tag).toBe("SingleObjective")

      if (result._tag !== "SingleObjective") {
        return
      }

      expect(result.bestTrial.config).toEqual({ critiquePassBudget: 2, retrievalDepth: 1 })
      expect(result.bestTrial.state.value).toBeCloseTo(0.88, 12)
    }))
})
