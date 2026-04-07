/**
 * Workflow, example, and artifact projections for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */

import { projectOpenAgentTraceToArtifact as projectOpenAgentTraceToArtifactInternal } from "./artifactProjection.js"
import {
  projectOpenAgentTraceToExamples as projectOpenAgentTraceToExamplesInternal,
  projectOpenAgentTraceToWorkflow as projectOpenAgentTraceToWorkflowInternal
} from "./workflowProjection.js"

/**
 * Project one normalized trace into the reusable workflow-record family owned by `effect-inference/Contracts`.
 *
 * @since 0.2.0
 */
export const projectOpenAgentTraceToWorkflow = projectOpenAgentTraceToWorkflowInternal

/**
 * Project one normalized trace into bounded optimization-ready examples and comparison cases.
 *
 * @since 0.2.0
 */
export const projectOpenAgentTraceToExamples = projectOpenAgentTraceToExamplesInternal

/**
 * Wrap one normalized trace or bounded projection in `effect-search` artifact-envelope transport.
 *
 * @since 0.2.0
 */
export const projectOpenAgentTraceToArtifact = projectOpenAgentTraceToArtifactInternal

/**
 * Re-export of projection and artifact schemas for the experimental lane.
 *
 * @since 0.2.0
 */
export * from "./projectionSchema.js"
