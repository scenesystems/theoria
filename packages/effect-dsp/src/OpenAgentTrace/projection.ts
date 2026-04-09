/**
 * Workflow, example, and artifact projection surfaces for normalized open-agent-trace records.
 *
 * @since 0.2.0
 */

import { projectArtifact as projectArtifactInternal } from "./artifactProjection.js"
import {
  projectExamples as projectExamplesInternal,
  projectWorkflow as projectWorkflowInternal
} from "./workflowProjection.js"

/**
 * Workflow projection surface for normalized records.
 *
 * @since 0.2.0
 */
export const Workflow = {
  project: projectWorkflowInternal
}

/**
 * Example projection surface for normalized records.
 *
 * @since 0.2.0
 */
export const Examples = {
  project: projectExamplesInternal
}

/**
 * Artifact-envelope projection surface for normalized records and derived projections.
 *
 * @since 0.2.0
 */
export const Artifact = {
  project: projectArtifactInternal
}

/**
 * Re-export of projection and artifact schemas for the experimental lane.
 *
 * @since 0.2.0
 */
export * from "./projectionSchema.js"
