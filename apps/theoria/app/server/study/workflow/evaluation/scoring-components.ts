import { Match } from "effect"
import type { ScoreComponentKind, ScoreComponentResult, WorkflowNodeKind } from "effect-inference/Contracts"
import * as Statistics from "effect-math/Statistics"

import type { WorkflowVariantPlan } from "../../../../contracts/study/workflow/runtime-plan.js"
import type { ExecutionFeatures } from "./scoring-features.js"

const zeroToOne = (value: number): number => Math.max(0, Math.min(1, value))

const average = (values: ReadonlyArray<number>): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

const tokenize = (value: string): ReadonlyArray<string> =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 0)

const signalCoverage = (text: string, signal: string): number => {
  const tokens = tokenize(signal)

  return tokens.length === 0
    ? 0
    : average(tokens.map((token) => (text.includes(token) ? 1 : 0)))
}

const promptCoverage = (text: string, prompt: string): number => {
  const tokens = tokenize(prompt).slice(0, 4)

  return tokens.length === 0
    ? 0
    : average(tokens.map((token) => (text.includes(token) ? 1 : 0)))
}

const hasNodeKind = (features: ExecutionFeatures, nodeKind: WorkflowNodeKind): boolean =>
  features.nodeKinds.includes(nodeKind)

const rawComponentValue = ({
  casePrompt,
  component,
  expectedSignals,
  features,
  renderCritical,
  workflowKind
}: {
  readonly casePrompt: string
  readonly component: ScoreComponentKind
  readonly expectedSignals: ReadonlyArray<string>
  readonly features: ExecutionFeatures
  readonly renderCritical: boolean
  readonly workflowKind: WorkflowVariantPlan["record"]["workflowKind"]
}): number => {
  const expectedSignalCoverage = average(
    expectedSignals.map((signal) => signalCoverage(features.normalizedText, signal))
  )
  const promptSignalCoverage = promptCoverage(features.normalizedText, casePrompt)
  const withinToleranceScore = features.renderEvidence.widthOverflowPx <= features.renderEvidence.input.tolerancePx
    ? 1
    : zeroToOne(1 - (features.renderEvidence.widthOverflowPx - features.renderEvidence.input.tolerancePx) / 420)
  const foldCoverageScore = zeroToOne(features.renderEvidence.aboveFoldCoverage)
  const belowFoldScore = features.renderEvidence.spillBelowFoldPx <= 0
    ? 1
    : zeroToOne(1 - features.renderEvidence.spillBelowFoldPx / 120)

  return Match.value(component).pipe(
    Match.when(
      "taskSuccess",
      () =>
        zeroToOne(
          0.45 * expectedSignalCoverage
            + 0.2 * promptSignalCoverage
            + (hasNodeKind(features, "critic") ? 0.15 : 0)
            + (hasNodeKind(features, "retrieval") ? 0.08 : 0)
            + (hasNodeKind(features, "render-evaluator") ? 0.06 : 0)
        )
    ),
    Match.when(
      "grounding",
      () =>
        zeroToOne(
          0.35
            + 0.25 * expectedSignalCoverage
            + 0.2 * features.runtimeEvidenceCompleteness
            + (hasNodeKind(features, "retrieval") ? 0.15 : 0)
            + (hasNodeKind(features, "critic") ? 0.05 : 0)
        )
    ),
    Match.when(
      "conversationContinuity",
      () =>
        zeroToOne(
          0.15
            + (workflowKind === "chat-continuation" ? 0.2 : 0)
            + (features.conversationTurnCount > 2 ? 0.1 : 0)
            + (hasNodeKind(features, "chat-handoff") ? 0.2 : 0)
            + (hasNodeKind(features, "retrieval") ? 0.1 : 0)
            + (hasNodeKind(features, "render-evaluator") ? 0.1 : 0)
            + 0.15 * promptSignalCoverage
        )
    ),
    Match.when(
      "routeEfficiency",
      () =>
        zeroToOne(
          1
            - Math.max(features.stepCount - 1, 0) * 0.12
            + (hasNodeKind(features, "retrieval") ? 0.04 : 0)
            + (hasNodeKind(features, "critic") ? 0.02 : 0)
        )
    ),
    Match.when(
      "renderFitness",
      () =>
        renderCritical
          ? zeroToOne(
            0.2 * expectedSignalCoverage
              + 0.25 * foldCoverageScore
              + 0.25 * belowFoldScore
              + 0.15 * withinToleranceScore
              + (hasNodeKind(features, "render-evaluator") ? 0.15 : 0)
          )
          : zeroToOne(0.45 * foldCoverageScore + 0.35 * belowFoldScore + 0.2 * withinToleranceScore)
    ),
    Match.when("tokenCost", () => features.totalTokenCost),
    Match.when("latency", () => features.totalLatencyMs),
    Match.exhaustive
  )
}

const normalizedComponentValue = ({
  component,
  plan,
  rawValue
}: {
  readonly component: ScoreComponentKind
  readonly plan: WorkflowVariantPlan
  readonly rawValue: number
}): number => {
  const normalization = plan.profile.normalization[component]

  return normalization.kind === "budget-inverse"
    ? Statistics.normalizeInverseBudget(rawValue, { budget: normalization.budget })
    : normalization.kind === "support-profile-tolerance"
    ? zeroToOne(rawValue)
    : Statistics.normalizeBeneficial(rawValue, { maximum: 1, minimum: 0 })
}

export const aggregateScore = (components: ReadonlyArray<ScoreComponentResult>): number => {
  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0)

  return totalWeight <= 0
    ? 0
    : zeroToOne(components.reduce((sum, component) => sum + component.weightedValue, 0) / totalWeight)
}

export const caseComponentResults = ({
  casePrompt,
  expectedSignals,
  features,
  plan,
  renderCritical
}: {
  readonly casePrompt: string
  readonly expectedSignals: ReadonlyArray<string>
  readonly features: ExecutionFeatures
  readonly plan: WorkflowVariantPlan
  readonly renderCritical: boolean
}): ReadonlyArray<ScoreComponentResult> =>
  plan.profile.components.map((component) => {
    const rawValue = rawComponentValue({
      casePrompt,
      component,
      expectedSignals,
      features,
      renderCritical,
      workflowKind: plan.record.workflowKind
    })
    const normalizedValue = normalizedComponentValue({ component, plan, rawValue })
    const weight = plan.profile.weights[component]

    return {
      component,
      rawValue,
      normalizedValue,
      weight,
      weightedValue: normalizedValue * weight
    }
  })
