import type { WorkflowProfileLibrary } from "../../../contracts/study/workflow/scenario.js"

import { decodeWorkflowProfile } from "./decode.js"
import { workflowRenderNormalization } from "./render-evidence.js"

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
  renderFitness: workflowRenderNormalization(),
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
  taskOriented: decodeWorkflowProfile({
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
  chatOriented: decodeWorkflowProfile({
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
  retrievalOriented: decodeWorkflowProfile({
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
  renderSensitive: decodeWorkflowProfile({
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
