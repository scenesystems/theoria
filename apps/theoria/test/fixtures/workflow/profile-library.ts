import type { WorkflowProfileLibrary } from "../../../app/contracts/study/workflow/scenario.js"
import { makeWorkflowProfile } from "./decode.js"

const sharedNormalization = {
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
  tokenCost: { kind: "budget-inverse", direction: "lower-is-better", budget: 3072, unit: "tokens" },
  latency: { kind: "budget-inverse", direction: "lower-is-better", budget: 1200, unit: "milliseconds" }
}

const releasedComponents = [
  "taskSuccess",
  "grounding",
  "conversationContinuity",
  "routeEfficiency",
  "renderFitness",
  "tokenCost",
  "latency"
]

export const workflowProfileLibrary: WorkflowProfileLibrary = {
  taskOriented: makeWorkflowProfile({
    profileId: "task-briefing-default",
    profileFamily: "task-oriented",
    workflowKinds: ["task-first"],
    components: [...releasedComponents],
    weights: {
      taskSuccess: 0.45,
      grounding: 0.2,
      conversationContinuity: 0,
      routeEfficiency: 0.15,
      renderFitness: 0,
      tokenCost: 0.1,
      latency: 0.1
    },
    normalization: sharedNormalization
  }),
  chatOriented: makeWorkflowProfile({
    profileId: "chat-handoff-default",
    profileFamily: "chat-oriented",
    workflowKinds: ["chat-continuation"],
    components: [...releasedComponents],
    weights: {
      taskSuccess: 0.2,
      grounding: 0.15,
      conversationContinuity: 0.35,
      routeEfficiency: 0.1,
      renderFitness: 0.05,
      tokenCost: 0.05,
      latency: 0.1
    },
    normalization: sharedNormalization
  }),
  retrievalOriented: makeWorkflowProfile({
    profileId: "retrieval-default",
    profileFamily: "retrieval-oriented",
    workflowKinds: ["retrieval-required"],
    components: [...releasedComponents],
    weights: {
      taskSuccess: 0.25,
      grounding: 0.3,
      conversationContinuity: 0.05,
      routeEfficiency: 0.2,
      renderFitness: 0.05,
      tokenCost: 0.05,
      latency: 0.1
    },
    normalization: sharedNormalization
  }),
  renderSensitive: makeWorkflowProfile({
    profileId: "render-sensitive-default",
    profileFamily: "render-sensitive",
    workflowKinds: ["render-sensitive", "chat-continuation"],
    components: [...releasedComponents],
    weights: {
      taskSuccess: 0.3,
      grounding: 0.15,
      conversationContinuity: 0.1,
      routeEfficiency: 0.05,
      renderFitness: 0.25,
      tokenCost: 0.05,
      latency: 0.1
    },
    normalization: sharedNormalization
  })
}
