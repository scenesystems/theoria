import { describe, expect, it } from "@effect/vitest"
import { Either, Schema } from "effect"

import * as Contracts from "../../src/contracts/index.js"

const renderSensitiveProfile = {
  profileId: "render-balanced",
  profileFamily: "render-sensitive",
  workflowKinds: ["chat-continuation", "render-sensitive"],
  components: [
    "taskSuccess",
    "grounding",
    "conversationContinuity",
    "routeEfficiency",
    "renderFitness",
    "tokenCost",
    "latency"
  ],
  weights: {
    taskSuccess: 0.4,
    grounding: 0.2,
    conversationContinuity: 0.1,
    routeEfficiency: 0.05,
    renderFitness: 0.15,
    tokenCost: 0.05,
    latency: 0.05
  },
  normalization: {
    taskSuccess: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    grounding: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    conversationContinuity: {
      kind: "identity-zero-to-one",
      direction: "higher-is-better",
      minimum: 0,
      maximum: 1
    },
    routeEfficiency: { kind: "identity-zero-to-one", direction: "higher-is-better", minimum: 0, maximum: 1 },
    renderFitness: {
      kind: "support-profile-tolerance",
      direction: "higher-is-better",
      supportProfileRef: "browser-default",
      fontIdentityRef: "geist-sans-v1",
      fontReadinessRevision: "fonts-ready-1",
      toleranceRef: "browser-default-tolerances"
    },
    tokenCost: { kind: "budget-inverse", direction: "lower-is-better", budget: 4096, unit: "tokens" },
    latency: { kind: "budget-inverse", direction: "lower-is-better", budget: 1200, unit: "milliseconds" }
  }
}

const workflowEvaluationReport = {
  reportId: "workflow-report-1",
  workflowKind: "render-sensitive",
  profile: renderSensitiveProfile,
  totalCases: 2,
  aggregateScore: 0.81,
  componentBreakdown: [
    {
      component: "taskSuccess",
      rawValue: 0.9,
      normalizedValue: 0.9,
      weight: 0.4,
      weightedValue: 0.36
    },
    {
      component: "renderFitness",
      rawValue: 0.88,
      normalizedValue: 0.88,
      weight: 0.15,
      weightedValue: 0.132
    },
    {
      component: "tokenCost",
      rawValue: 512,
      normalizedValue: 0.875,
      weight: 0.05,
      weightedValue: 0.04375
    }
  ],
  lossSummary: {
    count: 2,
    mean: 0.19,
    minimum: 0.1,
    maximum: 0.28,
    variance: 0.0081,
    standardDeviation: 0.09
  },
  caseResults: [
    {
      caseId: "case-1",
      score: 0.9,
      loss: 0.1,
      components: [
        {
          component: "taskSuccess",
          rawValue: 1,
          normalizedValue: 1,
          weight: 0.4,
          weightedValue: 0.4
        },
        {
          component: "renderFitness",
          rawValue: 0.93,
          normalizedValue: 0.93,
          weight: 0.15,
          weightedValue: 0.1395
        }
      ]
    },
    {
      caseId: "case-2",
      score: 0.72,
      loss: 0.28,
      components: [
        {
          component: "taskSuccess",
          rawValue: 0.8,
          normalizedValue: 0.8,
          weight: 0.4,
          weightedValue: 0.32
        },
        {
          component: "latency",
          rawValue: 900,
          normalizedValue: 0.25,
          weight: 0.05,
          weightedValue: 0.0125
        }
      ]
    }
  ]
}

describe("Contracts/workflow-score", () => {
  it("keeps the released workflow score-component vocabulary exact", () => {
    const releasedComponents = [
      "taskSuccess",
      "grounding",
      "conversationContinuity",
      "routeEfficiency",
      "renderFitness",
      "tokenCost",
      "latency"
    ].every((component) =>
      Either.isRight(
        Schema.decodeUnknownEither(Contracts.ScoreComponentKindSchema)(component, {
          onExcessProperty: "error"
        })
      )
    )

    const legacyComponentsStayRejected = ["quality", "cost", "speed", "render"].every((component) =>
      Either.isLeft(
        Schema.decodeUnknownEither(Contracts.ScoreComponentKindSchema)(component, {
          onExcessProperty: "error"
        })
      )
    )

    expect(releasedComponents).toBe(true)
    expect(legacyComponentsStayRejected).toBe(true)
  })

  it("decodes workflow score weights, profiles, component results, and reports", () => {
    const weights = Schema.decodeUnknownEither(Contracts.ScoreWeightsSchema)(renderSensitiveProfile.weights, {
      onExcessProperty: "error"
    })
    const profile = Schema.decodeUnknownEither(Contracts.ScoreProfileSchema)(renderSensitiveProfile, {
      onExcessProperty: "error"
    })
    const component = Schema.decodeUnknownEither(Contracts.ScoreComponentResultSchema)(
      workflowEvaluationReport.componentBreakdown[0],
      { onExcessProperty: "error" }
    )
    const lossSummary = Schema.decodeUnknownEither(Contracts.ScoreLossSummarySchema)(
      workflowEvaluationReport.lossSummary,
      {
        onExcessProperty: "error"
      }
    )
    const report = Schema.decodeUnknownEither(Contracts.WorkflowEvaluationReportSchema)(workflowEvaluationReport, {
      onExcessProperty: "error"
    })

    expect(Either.isRight(weights)).toBe(true)
    expect(Either.isRight(profile)).toBe(true)
    expect(Either.isRight(component)).toBe(true)
    expect(Either.isRight(lossSummary)).toBe(true)
    expect(Either.isRight(report)).toBe(true)
  })

  it("rejects invalid normalization and budget cases", () => {
    const invalidNegativeWeight = Schema.decodeUnknownEither(Contracts.ScoreWeightsSchema)(
      {
        ...renderSensitiveProfile.weights,
        tokenCost: -0.05
      },
      { onExcessProperty: "error" }
    )
    const invalidZeroBudget = Schema.decodeUnknownEither(Contracts.ScoreProfileSchema)(
      {
        ...renderSensitiveProfile,
        normalization: {
          ...renderSensitiveProfile.normalization,
          latency: {
            ...renderSensitiveProfile.normalization.latency,
            budget: 0
          }
        }
      },
      { onExcessProperty: "error" }
    )
    const invalidAllZeroProfile = Schema.decodeUnknownEither(Contracts.ScoreProfileSchema)(
      {
        ...renderSensitiveProfile,
        weights: {
          taskSuccess: 0,
          grounding: 0,
          conversationContinuity: 0,
          routeEfficiency: 0,
          renderFitness: 0,
          tokenCost: 0,
          latency: 0
        }
      },
      { onExcessProperty: "error" }
    )

    expect(Either.isLeft(invalidNegativeWeight)).toBe(true)
    expect(Either.isLeft(invalidZeroBudget)).toBe(true)
    expect(Either.isLeft(invalidAllZeroProfile)).toBe(true)
  })

  it("round-trips workflow score reports deterministically", () => {
    const decoded = Schema.decodeUnknownSync(Contracts.WorkflowEvaluationReportSchema)(workflowEvaluationReport, {
      onExcessProperty: "error"
    })
    const encoded = Schema.encodeSync(Contracts.WorkflowEvaluationReportSchema)(decoded)

    expect(encoded).toEqual(workflowEvaluationReport)
  })
})
